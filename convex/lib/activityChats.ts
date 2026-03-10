import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { incrementUnreadCount } from './notifications';

interface SyncActivityConversationArgs {
  activityId: Id<'activities'>;
  actorUserId?: Id<'users'>;
}

async function getJoinedParticipantUserIds(ctx: MutationCtx, activityId: Id<'activities'>) {
  const participants = await ctx.db
    .query('activityParticipants')
    .withIndex('by_activity', q => q.eq('activityId', activityId))
    .collect();

  return Array.from(new Set(participants.filter(p => p.status === 'JOINED').map(p => p.userId)));
}

export async function deleteConversationCascade(ctx: MutationCtx, conversationId: Id<'conversations'>): Promise<void> {
  const participants = await ctx.db
    .query('conversationParticipants')
    .withIndex('by_conversation_id', q => q.eq('conversationId', conversationId))
    .collect();

  for (const participant of participants) {
    await ctx.db.delete('conversationParticipants', participant._id);
  }

  const messages = await ctx.db
    .query('messages')
    .withIndex('by_conversation_id', q => q.eq('conversationId', conversationId))
    .collect();

  for (const message of messages) {
    await ctx.db.delete('messages', message._id);
  }

  await ctx.db.delete('conversations', conversationId);
}

export async function syncActivityConversation(
  ctx: MutationCtx,
  args: SyncActivityConversationArgs
): Promise<Id<'conversations'> | null> {
  const activity = await ctx.db.get('activities', args.activityId);
  if (!activity) {
    return null;
  }

  const joinedUserIds = await getJoinedParticipantUserIds(ctx, args.activityId);
  const existingConversation = await ctx.db
    .query('conversations')
    .withIndex('by_activity', q => q.eq('activityId', args.activityId))
    .unique();

  if (activity.status === 'CANCELLED' || joinedUserIds.length < 2) {
    if (existingConversation) {
      await deleteConversationCascade(ctx, existingConversation._id);
    }
    return null;
  }

  const existingParticipants = existingConversation
    ? await ctx.db
        .query('conversationParticipants')
        .withIndex('by_conversation_id', q => q.eq('conversationId', existingConversation._id))
        .collect()
    : [];

  const existingUserIds = new Set(existingParticipants.map(participant => participant.userId));

  const conversationId =
    existingConversation?._id ??
    (await ctx.db.insert('conversations', {
      type: 'ACTIVITY',
      name: activity.title,
      activityId: args.activityId,
      lastMessageAt: undefined,
      lastMessagePreview: undefined
    }));

  for (const participant of existingParticipants) {
    if (!joinedUserIds.includes(participant.userId)) {
      await ctx.db.delete('conversationParticipants', participant._id);
      continue;
    }

    if (participant.hiddenAt) {
      await ctx.db.patch('conversationParticipants', participant._id, {
        hiddenAt: undefined
      });
    }
  }

  const addedUserIds: Id<'users'>[] = [];
  for (const userId of joinedUserIds) {
    if (existingUserIds.has(userId)) {
      continue;
    }

    addedUserIds.push(userId);
    await ctx.db.insert('conversationParticipants', {
      conversationId,
      userId
    });
  }

  const shouldNotifyCreated = !existingConversation;
  const shouldNotifyAdded = !!existingConversation && addedUserIds.length > 0;

  if (!shouldNotifyCreated && !shouldNotifyAdded) {
    return conversationId;
  }

  const actor = args.actorUserId ? await ctx.db.get('users', args.actorUserId) : null;
  const actorLabel = actor?.username ? `@${actor.username}` : 'A player';

  const title = shouldNotifyCreated ? 'Game Chat Created' : 'Player Added to Game Chat';
  const body = shouldNotifyCreated
    ? `Group chat is ready for ${activity.title}.`
    : `${actorLabel} joined the group chat for ${activity.title}.`;

  for (const userId of joinedUserIds) {
    await ctx.db.insert('notifications', {
      userId,
      type: 'ACTIVITY_CHAT',
      title,
      body,
      read: false,
      data: {
        activityId: args.activityId,
        conversationId,
        actorUserId: args.actorUserId
      }
    });

    await incrementUnreadCount(ctx, userId);
  }

  return conversationId;
}
