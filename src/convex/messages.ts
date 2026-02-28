import { z } from 'zod';

import { incrementUnreadCount } from './lib/notifications';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { messageSchema } from './lib/zodSchemas';
import { requireUser } from './users';

/**
 * Send a message in a conversation.
 */
export const sendMessage = zMutation({
  args: {
    conversationId: zid('conversations'),
    content: z.string()
  },
  returns: zid('messages'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Check if user is a participant
    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', userId)
      )
      .unique();

    if (!participation) {
      throw new Error('Not a participant of this conversation');
    }

    const now = Date.now();

    // Insert message
    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content
    });

    // Update conversation with last message info
    const preview = args.content.length > 50 ? args.content.substring(0, 47) + '...' : args.content;

    await ctx.db.patch('conversations', args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview
    });

    // Create notifications for other participants
    const allParticipants = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
      .collect();

    const sender = await ctx.db.get('users', userId);
    const senderName = sender?.username ?? 'Someone';

    for (const p of allParticipants) {
      if (p.userId !== userId) {
        await ctx.db.insert('notifications', {
          userId: p.userId,
          type: 'MESSAGE',
          title: 'New Message',
          body: `${senderName}: ${preview}`,
          read: false,
          data: {
            conversationId: args.conversationId,
            messageId,
            senderId: userId,
            actorUserId: userId,
            actorUsername: senderName
          }
        });

        await incrementUnreadCount(ctx, p.userId);
      }
    }

    return messageId;
  }
});

/**
 * Get messages for a conversation.
 */
export const getMessages = zQuery({
  args: {
    conversationId: zid('conversations'),
    limit: z.number().optional()
  },
  returns: z.array(
    z.object({
      message: messageSchema,
      sender: z.object({
        _id: zid('users'),
        username: z.string(),
        tokenIdentifier: z.string()
      })
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

    // Check if user is a participant
    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', user._id)
      )
      .unique();

    if (!participation) {
      return [];
    }

    const limit = args.limit ?? 50;

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(limit);

    // Reverse to get chronological order
    messages.reverse();

    const senderIds = Array.from(new Set(messages.map(message => message.senderId)));
    const senders = await Promise.all(senderIds.map(id => ctx.db.get('users', id)));
    const senderById = new Map(senders.filter(Boolean).map(sender => [sender!._id, sender!]));

    const results: Array<{
      message: (typeof messages)[number];
      sender: {
        _id: (typeof messages)[number]['senderId'];
        username: string;
        tokenIdentifier: string;
      };
    }> = [];

    for (const message of messages) {
      const sender = senderById.get(message.senderId);
      results.push({
        message,
        sender: sender
          ? {
              _id: sender._id,
              username: sender.username,
              tokenIdentifier: sender.tokenIdentifier
            }
          : {
              _id: message.senderId,
              username: 'Unknown User',
              tokenIdentifier: ''
            }
      });
    }

    return results;
  }
});

/**
 * Get recent messages for a conversation (for inbox preview).
 */
export const getRecentMessages = zQuery({
  args: {
    conversationId: zid('conversations')
  },
  returns: z.array(messageSchema),
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

    // Check if user is a participant
    const participation = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversation_id_and_user_id', q =>
        q.eq('conversationId', args.conversationId).eq('userId', user._id)
      )
      .unique();

    if (!participation) {
      return [];
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', q => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(5);

    return messages.reverse();
  }
});

/**
 * Delete a message.
 */
export const deleteMessage = zMutation({
  args: {
    messageId: zid('messages')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const message = await ctx.db.get('messages', args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('Not authorized to delete this message');
    }

    await ctx.db.delete('messages', args.messageId);

    // Update conversation last message if this was it
    const conversation = await ctx.db.get('conversations', message.conversationId);
    if (conversation) {
      const lastMessage = await ctx.db
        .query('messages')
        .withIndex('by_conversation_id', q => q.eq('conversationId', message.conversationId))
        .order('desc')
        .first();

      if (lastMessage) {
        const preview =
          lastMessage.content.length > 50 ? lastMessage.content.substring(0, 47) + '...' : lastMessage.content;

        await ctx.db.patch('conversations', message.conversationId, {
          lastMessageAt: lastMessage._creationTime,
          lastMessagePreview: preview
        });
      } else {
        await ctx.db.patch('conversations', message.conversationId, {
          lastMessageAt: undefined,
          lastMessagePreview: undefined
        });
      }
    }

    return null;
  }
});
