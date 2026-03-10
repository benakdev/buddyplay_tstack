import { z } from 'zod';

import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { deleteConversationCascade, syncActivityConversation } from './lib/activityChats';
import { conversationTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { conversationSchema } from './lib/zodSchemas';
import { getCurrentAuthenticatedUser, requireUser } from './users';

async function getConversationParticipantsWithUsers(ctx: QueryCtx, conversationId: Id<'conversations'>) {
  const allParticipants = await ctx.db
    .query('conversationParticipants')
    .withIndex('by_conversation_id', q => q.eq('conversationId', conversationId))
    .collect();

  const participantIds = Array.from(new Set(allParticipants.map(p => p.userId)));
  const participantUsersDocs = await Promise.all(participantIds.map(id => ctx.db.get('users', id)));
  const participantById = new Map(participantUsersDocs.filter(Boolean).map(p => [p!._id, p!]));

  const participantUsers: Array<{
    _id: Id<'users'>;
    username: string;
    firstName?: string;
    lastName?: string;
    tokenIdentifier: string;
    profileUrl?: string;
  }> = [];

  for (const p of allParticipants) {
    const participantUser = participantById.get(p.userId);
    if (participantUser) {
      participantUsers.push({
        _id: participantUser._id,
        username: participantUser.username,
        firstName: participantUser.firstName,
        lastName: participantUser.lastName,
        tokenIdentifier: participantUser.tokenIdentifier,
        profileUrl: participantUser.profileUrl
      });
    }
  }

  return participantUsers;
}

/**
 * Create a new conversation.
 */
export const createConversation = zMutation({
  args: {
    type: conversationTypeSchema,
    name: z.string().optional(),
    participantIds: z.array(zid('users')),
    activityId: zid('activities').optional()
  },
  returns: zid('conversations'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Ensure current user is included in participants
    const participantIds = args.participantIds.includes(userId)
      ? args.participantIds
      : [...args.participantIds, userId];

    // For DMs, check if conversation already exists
    if (args.type === 'DM' && participantIds.length === 2) {
      const [userId1, userId2] = participantIds;

      // Find existing DM between these users
      const existingConversations = await ctx.db
        .query('conversations')
        .withIndex('by_type', q => q.eq('type', 'DM'))
        .collect();

      for (const conv of existingConversations) {
        const participants = await ctx.db
          .query('conversationParticipants')
          .withIndex('by_conversation_id', q => q.eq('conversationId', conv._id))
          .collect();

        const participantUserIds = participants.map(p => p.userId);
        if (
          participantUserIds.length === 2 &&
          participantUserIds.includes(userId1) &&
          participantUserIds.includes(userId2)
        ) {
          return conv._id;
        }
      }
    }

    // Create conversation
    const conversationId = await ctx.db.insert('conversations', {
      type: args.type,
      name: args.name,
      activityId: args.activityId,
      lastMessageAt: undefined,
      lastMessagePreview: undefined
    });

    // Add participants
    for (const participantId of participantIds) {
      await ctx.db.insert('conversationParticipants', {
        conversationId,
        userId: participantId
      });
    }

    return conversationId;
  }
});

/**
 * Create a DM conversation with another user.
 */
export const createDM = zMutation({
  args: {
    otherUserId: zid('users')
  },
  returns: zid('conversations'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    if (userId === args.otherUserId) {
      throw new Error('Cannot create DM with yourself');
    }

    // Check if DM already exists
    const myParticipations = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_user_id', q => q.eq('userId', userId))
      .collect();

    for (const participation of myParticipations) {
      const conv = await ctx.db.get('conversations', participation.conversationId);
      if (conv?.type !== 'DM') continue;

      const otherParticipants = await ctx.db
        .query('conversationParticipants')
        .withIndex('by_conversation_id', q => q.eq('conversationId', participation.conversationId))
        .collect();

      if (otherParticipants.length === 2 && otherParticipants.some(p => p.userId === args.otherUserId)) {
        return participation.conversationId;
      }
    }

    // Create new DM
    const conversationId = await ctx.db.insert('conversations', {
      type: 'DM',
      name: undefined,
      activityId: undefined,
      lastMessageAt: undefined,
      lastMessagePreview: undefined
    });

    await ctx.db.insert('conversationParticipants', {
      conversationId,
      userId
    });

    await ctx.db.insert('conversationParticipants', {
      conversationId,
      userId: args.otherUserId
    });

    return conversationId;
  }
});

/**
 * Create an activity conversation (group chat for a game).
 */
export const createActivityConversation = zMutation({
  args: {
    activityId: zid('activities'),
    name: z.string().optional()
  },
  returns: zid('conversations'),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const conversationId = await syncActivityConversation(ctx, {
      activityId: args.activityId
    });

    if (!conversationId) {
      throw new Error('Activity chat requires at least 2 joined players');
    }

    if (args.name) {
      await ctx.db.patch('conversations', conversationId, {
        name: args.name
      });
    }

    return conversationId;
  }
});

/**
 * Get all conversations for the current user.
 */
export const getMyConversations = zQuery({
  args: {
    limit: z.number().optional()
  },
  returns: z.array(
    z.object({
      conversation: conversationSchema,
      participants: z.array(
        z.object({
          _id: zid('users'),
          username: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          tokenIdentifier: z.string(),
          profileUrl: z.string().optional()
        })
      )
    })
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Get user's conversation participations
    const participations = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_user_id', q => q.eq('userId', user._id))
      .collect();

    const results: Array<{
      conversation: Awaited<ReturnType<typeof ctx.db.get<'conversations'>>> & {};
      participants: Array<{
        _id: typeof user._id;
        username: string;
        firstName?: string;
        lastName?: string;
        tokenIdentifier: string;
        profileUrl?: string;
      }>;
    }> = [];

    for (const participation of participations) {
      if (participation.hiddenAt) continue;

      const conversation = await ctx.db.get('conversations', participation.conversationId);
      if (!conversation) continue;
      const participantUsers = await getConversationParticipantsWithUsers(ctx, conversation._id);

      results.push({
        conversation,
        participants: participantUsers
      });
    }

    // Sort by lastMessageAt
    results.sort((a, b) => {
      const aTime = a.conversation.lastMessageAt ?? a.conversation._creationTime;
      const bTime = b.conversation.lastMessageAt ?? b.conversation._creationTime;
      return bTime - aTime;
    });

    return results.slice(0, args.limit ?? 50);
  }
});

/**
 * Get a specific conversation with participants.
 */
export const getConversation = zQuery({
  args: {
    conversationId: zid('conversations')
  },
  returns: z
    .object({
      conversation: conversationSchema,
      participants: z.array(
        z.object({
          _id: zid('users'),
          username: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          tokenIdentifier: z.string(),
          profileUrl: z.string().optional()
        })
      )
    })
    .nullable(),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const conversation = await ctx.db.get('conversations', args.conversationId);
    if (!conversation) {
      return null;
    }

    // Check if user is a participant
    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', user._id)
      )
      .unique();

    if (!participation) {
      return null;
    }

    const participantUsers = await getConversationParticipantsWithUsers(ctx, args.conversationId);

    return {
      conversation,
      participants: participantUsers
    };
  }
});

/**
 * Add a participant to a conversation.
 */
export const addParticipant = zMutation({
  args: {
    conversationId: zid('conversations'),
    userId: zid('users')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const conversation = await ctx.db.get('conversations', args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check if already a participant
    const existing = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId)
      )
      .unique();

    if (existing) {
      return null;
    }

    await ctx.db.insert('conversationParticipants', {
      conversationId: args.conversationId,
      userId: args.userId
    });

    return null;
  }
});

/**
 * Hide a DM conversation from the current user's inbox.
 */
export const hideConversation = zMutation({
  args: {
    conversationId: zid('conversations')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const conversation = await ctx.db.get('conversations', args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type !== 'DM') {
      throw new Error('Only direct messages can be hidden');
    }

    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', userId)
      )
      .unique();

    if (!participation) {
      throw new Error('Not a participant of this conversation');
    }

    await ctx.db.patch('conversationParticipants', participation._id, {
      hiddenAt: Date.now()
    });

    return null;
  }
});

/**
 * Leave a conversation.
 */
export const leaveConversation = zMutation({
  args: {
    conversationId: zid('conversations')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const conversation = await ctx.db.get('conversations', args.conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type === 'DM') {
      throw new Error('Direct messages cannot be left. Hide the chat instead.');
    }

    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', userId)
      )
      .unique();

    if (!participation) {
      throw new Error('Not a participant of this conversation');
    }

    await ctx.db.delete('conversationParticipants', participation._id);

    // Check if conversation is now empty
    const remaining = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
      .first();

    if (!remaining) {
      await deleteConversationCascade(ctx, args.conversationId);
    }

    return null;
  }
});
