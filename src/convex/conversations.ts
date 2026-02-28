import { z } from 'zod';

import { conversationTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { conversationSchema } from './lib/zodSchemas';
import { requireUser } from './users';

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

    // Check if conversation already exists for this activity
    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_activity', q => q.eq('activityId', args.activityId))
      .unique();

    if (existing) {
      return existing._id;
    }

    // Create conversation
    const conversationId = await ctx.db.insert('conversations', {
      type: 'ACTIVITY',
      name: args.name ?? activity.title,
      activityId: args.activityId,
      lastMessageAt: undefined,
      lastMessagePreview: undefined
    });

    // Add all current participants
    const participants = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity', q => q.eq('activityId', args.activityId))
      .collect();

    for (const p of participants) {
      if (p.status === 'JOINED') {
        await ctx.db.insert('conversationParticipants', {
          conversationId,
          userId: p.userId
        });
      }
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
          tokenIdentifier: z.string()
        })
      )
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? 50;

    // Get user's conversation participations
    const participations = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_user_id', q => q.eq('userId', user._id))
      .take(limit);

    const results: Array<{
      conversation: Awaited<ReturnType<typeof ctx.db.get<'conversations'>>> & {};
      participants: Array<{ _id: typeof user._id; username: string; tokenIdentifier: string }>;
    }> = [];

    for (const participation of participations) {
      const conversation = await ctx.db.get('conversations', participation.conversationId);
      if (!conversation) continue;

      // Get other participants
      const allParticipants = await ctx.db
        .query('conversationParticipants')
        .withIndex('by_conversation_id', q => q.eq('conversationId', conversation._id))
        .collect();

      const participantIds = Array.from(new Set(allParticipants.map(p => p.userId)));
      const participantUsersDocs = await Promise.all(participantIds.map(id => ctx.db.get('users', id)));
      const participantById = new Map(participantUsersDocs.filter(Boolean).map(p => [p!._id, p!]));

      const participantUsers: Array<{ _id: typeof user._id; username: string; tokenIdentifier: string }> = [];
      for (const p of allParticipants) {
        const participantUser = participantById.get(p.userId);
        if (participantUser) {
          participantUsers.push({
            _id: participantUser._id,
            username: participantUser.username,
            tokenIdentifier: participantUser.tokenIdentifier
          });
        }
      }

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

    return results;
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
          tokenIdentifier: z.string()
        })
      )
    })
    .nullable(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

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

    // Get all participants
    const allParticipants = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
      .collect();

    const participantIds = Array.from(new Set(allParticipants.map(p => p.userId)));
    const participantUsersDocs = await Promise.all(participantIds.map(id => ctx.db.get('users', id)));
    const participantById = new Map(participantUsersDocs.filter(Boolean).map(p => [p!._id, p!]));

    const participantUsers: Array<{ _id: typeof user._id; username: string; tokenIdentifier: string }> = [];
    for (const p of allParticipants) {
      const participantUser = participantById.get(p.userId);
      if (participantUser) {
        participantUsers.push({
          _id: participantUser._id,
          username: participantUser.username,
          tokenIdentifier: participantUser.tokenIdentifier
        });
      }
    }

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
 * Leave a conversation.
 */
export const leaveConversation = zMutation({
  args: {
    conversationId: zid('conversations')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

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
      // Delete the conversation and its messages
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
        .collect();

      for (const message of messages) {
        await ctx.db.delete('messages', message._id);
      }

      await ctx.db.delete('conversations', args.conversationId);
    }

    return null;
  }
});
