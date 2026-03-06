import { z } from 'zod';

import type { Id } from './_generated/dataModel';
import { decrementUnreadCount, incrementUnreadCount, resetUnreadCount } from './lib/notifications';
import { notificationTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { notificationSchema, paginationOptsSchema } from './lib/zodSchemas';
import { requireUser } from './users';

type NotificationType = z.infer<typeof notificationTypeSchema>;

const notificationFilterArgs = {
  unreadOnly: z.boolean().optional(),
  includeTypes: z.array(notificationTypeSchema).optional(),
  excludeTypes: z.array(notificationTypeSchema).optional(),
  limit: z.number().optional()
};

const notificationActorSchema = z.object({
  _id: zid('users'),
  username: z.string(),
  tokenIdentifier: z.string()
});

const enrichedNotificationSchema = z.object({
  notification: notificationSchema,
  actor: notificationActorSchema.nullable()
});

interface NotificationData {
  actorUserId?: Id<'users'>;
  matchingUserId?: Id<'users'>;
  senderId?: Id<'users'>;
  requesterId?: Id<'users'>;
  userId?: Id<'users'>;
  requestId?: Id<'requests'>;
  activityId?: Id<'activities'>;
}

function getDirectActorUserId(data: NotificationData): Id<'users'> | undefined {
  return data.actorUserId ?? data.matchingUserId ?? data.senderId ?? data.requesterId ?? data.userId;
}

function filterNotificationsByType<T extends { type: NotificationType }>(
  notifications: T[],
  includeTypes?: NotificationType[],
  excludeTypes?: NotificationType[]
): T[] {
  const includeSet = includeTypes?.length ? new Set(includeTypes) : null;
  const excludeSet = excludeTypes?.length ? new Set(excludeTypes) : null;

  return notifications.filter(notification => {
    if (includeSet && !includeSet.has(notification.type)) {
      return false;
    }

    if (excludeSet && excludeSet.has(notification.type)) {
      return false;
    }

    return true;
  });
}

/**
 * Create a notification for a user.
 * Internal function - typically called from other mutations.
 */
export const createNotification = zMutation({
  args: {
    userId: zid('users'),
    type: notificationTypeSchema,
    title: z.string(),
    body: z.string(),
    data: z.any().optional()
  },
  returns: zid('notifications'),
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      read: false,
      data: args.data
    });

    await incrementUnreadCount(ctx, args.userId);

    return notificationId;
  }
});

/**
 * Get notifications for the current user.
 */
export const getMyNotifications = zQuery({
  args: notificationFilterArgs,
  returns: z.array(notificationSchema),
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

    const notifications = args.unreadOnly
      ? await ctx.db
          .query('notifications')
          .withIndex('by_user_read', q => q.eq('userId', user._id).eq('read', false))
          .order('desc')
          .collect()
      : await ctx.db
          .query('notifications')
          .withIndex('by_user', q => q.eq('userId', user._id))
          .order('desc')
          .collect();

    return filterNotificationsByType(notifications, args.includeTypes, args.excludeTypes).slice(0, limit);
  }
});

/**
 * Get notifications for the current user enriched with actor details.
 * Includes fallback actor resolution for old notifications that don't
 * carry actor metadata in `data`.
 */
export const getMyNotificationsEnriched = zQuery({
  args: notificationFilterArgs,
  returns: z.array(enrichedNotificationSchema),
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

    const rawNotifications = args.unreadOnly
      ? await ctx.db
          .query('notifications')
          .withIndex('by_user_read', q => q.eq('userId', user._id).eq('read', false))
          .order('desc')
        .collect()
      : await ctx.db
          .query('notifications')
          .withIndex('by_user', q => q.eq('userId', user._id))
          .order('desc')
        .collect();

    const notifications = filterNotificationsByType(rawNotifications, args.includeTypes, args.excludeTypes).slice(0, limit);

    const actorByNotificationId = new Map<string, Id<'users'>>();
    const requestFallbackIds = new Set<Id<'requests'>>();
    const activityFallbackIds = new Set<Id<'activities'>>();
    const dataByNotificationId = new Map<string, NotificationData>();

    for (const notification of notifications) {
      const data = (notification.data ?? {}) as NotificationData;
      dataByNotificationId.set(notification._id, data);

      const directActorUserId = getDirectActorUserId(data);
      if (directActorUserId) {
        actorByNotificationId.set(notification._id, directActorUserId);
        continue;
      }

      if ((notification.type === 'APPROVED' || notification.type === 'REJECTED') && data.requestId) {
        requestFallbackIds.add(data.requestId);
      } else if (notification.type === 'ACTIVITY_ALERT' && data.activityId) {
        activityFallbackIds.add(data.activityId);
      }
    }

    const [requestDocs, activityDocs] = await Promise.all([
      Promise.all(Array.from(requestFallbackIds).map(requestId => ctx.db.get('requests', requestId))),
      Promise.all(Array.from(activityFallbackIds).map(activityId => ctx.db.get('activities', activityId)))
    ]);

    const requestById = new Map(requestDocs.filter(Boolean).map(request => [request!._id, request!]));
    const activityById = new Map(activityDocs.filter(Boolean).map(activity => [activity!._id, activity!]));

    for (const notification of notifications) {
      if (actorByNotificationId.has(notification._id)) {
        continue;
      }

      const data = dataByNotificationId.get(notification._id) ?? {};

      if ((notification.type === 'APPROVED' || notification.type === 'REJECTED') && data.requestId) {
        const request = requestById.get(data.requestId);
        if (request?.hostId) {
          actorByNotificationId.set(notification._id, request.hostId);
        }
      } else if (notification.type === 'ACTIVITY_ALERT' && data.activityId) {
        const activity = activityById.get(data.activityId);
        if (activity?.creatorId) {
          actorByNotificationId.set(notification._id, activity.creatorId);
        }
      }
    }

    const uniqueActorIds = Array.from(new Set(actorByNotificationId.values()));
    const actorUsers = await Promise.all(uniqueActorIds.map(actorUserId => ctx.db.get('users', actorUserId)));
    const actorUserById = new Map(actorUsers.filter(Boolean).map(actor => [actor!._id, actor!]));

    return notifications.map(notification => {
      const actorId = actorByNotificationId.get(notification._id);
      const actorUser = actorId ? actorUserById.get(actorId) : null;

      return {
        notification,
        actor: actorUser
          ? {
              _id: actorUser._id,
              username: actorUser.username,
              tokenIdentifier: actorUser.tokenIdentifier
            }
          : null
      };
    });
  }
});

/**
 * Get notifications for the current user (paginated).
 */
export const getMyNotificationsPaginated = zQuery({
  args: {
    unreadOnly: z.boolean().optional(),
    paginationOpts: paginationOptsSchema
  },
  returns: z.object({
    page: z.array(notificationSchema),
    isDone: z.boolean(),
    continueCursor: z.string().nullable()
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { page: [], isDone: true, continueCursor: null };
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!user) {
      return { page: [], isDone: true, continueCursor: null };
    }

    if (args.unreadOnly) {
      return await ctx.db
        .query('notifications')
        .withIndex('by_user_read', q => q.eq('userId', user._id).eq('read', false))
        .order('desc')
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query('notifications')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .paginate(args.paginationOpts);
  }
});

/**
 * Get unread notification count for the current user.
 */
export const getUnreadCount = zQuery({
  args: {},
  returns: z.number(),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!user) {
      return 0;
    }

    return user.unreadNotificationCount ?? 0;
  }
});

/**
 * Mark a notification as read.
 */
export const markAsRead = zMutation({
  args: {
    notificationId: zid('notifications')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const notification = await ctx.db.get('notifications', args.notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (!notification.read) {
      await ctx.db.patch('notifications', args.notificationId, { read: true });
      await decrementUnreadCount(ctx, userId);
    }
    return null;
  }
});

/**
 * Mark all notifications as read for the current user.
 */
export const markAllAsRead = zMutation({
  args: {},
  returns: z.number(),
  handler: async ctx => {
    const userId = await requireUser(ctx);

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', q => q.eq('userId', userId).eq('read', false))
      .collect();

    for (const notification of unread) {
      await ctx.db.patch('notifications', notification._id, { read: true });
    }

    await resetUnreadCount(ctx, userId);

    return unread.length;
  }
});

/**
 * Delete a notification.
 */
export const deleteNotification = zMutation({
  args: {
    notificationId: zid('notifications')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const notification = await ctx.db.get('notifications', args.notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Not authorized');
    }

    await ctx.db.delete('notifications', args.notificationId);
    if (!notification.read) {
      await decrementUnreadCount(ctx, userId);
    }
    return null;
  }
});

/**
 * Delete all read notifications for the current user.
 */
export const clearReadNotifications = zMutation({
  args: {},
  returns: z.number(),
  handler: async ctx => {
    const userId = await requireUser(ctx);

    const read = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', q => q.eq('userId', userId).eq('read', true))
      .collect();

    for (const notification of read) {
      await ctx.db.delete('notifications', notification._id);
    }

    return read.length;
  }
});
