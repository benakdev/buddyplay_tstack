import { z } from 'zod';

import { syncActivityConversation } from './lib/activityChats';
import { incrementUnreadCount } from './lib/notifications';
import { requestStatusSchema, sportTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { paginationOptsSchema, requestSchema } from './lib/zodSchemas';
import { getCurrentAuthenticatedUser, requireUser } from './users';

function formatRequestBody(
  requesterUsername: string | undefined,
  activityTitle: string,
  locationLabel: string | undefined
): string {
  const gameLabel = locationLabel ? `${activityTitle} at ${locationLabel}` : activityTitle;

  if (requesterUsername) {
    return `@${requesterUsername} wants to join ${gameLabel}`;
  }

  return `A player wants to join ${gameLabel}`;
}

/**
 * Create a join request for an activity.
 */
export const createRequest = zMutation({
  args: {
    activityId: zid('activities'),
    message: z.string().optional()
  },
  returns: zid('requests'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Get the activity
    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.status !== 'OPEN') {
      throw new Error('Activity is not open for requests');
    }

    // Can't request to join own activity
    if (activity.creatorId === userId) {
      throw new Error('Cannot request to join your own activity');
    }

    // Check if already a participant
    const existingParticipant = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity_user', q => q.eq('activityId', args.activityId).eq('userId', userId))
      .unique();

    if (existingParticipant && existingParticipant.status === 'JOINED') {
      throw new Error('You are already a participant in this activity');
    }

    // Check if already requested
    const existingRequest = await ctx.db
      .query('requests')
      .withIndex('by_activity_user', q => q.eq('activityId', args.activityId).eq('userId', userId))
      .unique();

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new Error('You already have a pending request');
      }

      if (existingRequest.status === 'REJECTED') {
        throw new Error('Your previous request was declined. You can only join again if invited by the host.');
      }
    }

    const requestId = existingRequest?._id ?? (await ctx.db.insert('requests', {
      activityId: args.activityId,
      userId,
      hostId: activity.creatorId,
      status: 'PENDING',
      message: args.message,
      respondedAt: undefined
    }));

    if (existingRequest) {
      await ctx.db.patch('requests', requestId, {
        hostId: activity.creatorId,
        status: 'PENDING',
        message: args.message,
        respondedAt: undefined
      });
    }

    const requester = await ctx.db.get('users', userId);

    // Create notification for host
    await ctx.db.insert('notifications', {
      userId: activity.creatorId,
      type: 'REQUEST',
      title: 'Join Request',
      body: formatRequestBody(requester?.username, activity.title, activity.location.name ?? activity.location.city),
      read: false,
      data: {
        requestId,
        activityId: args.activityId,
        requesterId: userId,
        actorUserId: userId,
        actorUsername: requester?.username
      }
    });

    await incrementUnreadCount(ctx, activity.creatorId);

    return requestId;
  }
});

/**
 * Get pending requests for a user's hosted activities.
 */
export const getPendingRequests = zQuery({
  args: {},
  returns: z.array(
    z.object({
      request: requestSchema,
      requester: z.object({
        _id: zid('users'),
        username: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        profileUrl: z.string().optional()
      }),
      activity: z.object({
        _id: zid('activities'),
        title: z.string()
      })
    })
  ),
  handler: async ctx => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    const requests = await ctx.db
      .query('requests')
      .withIndex('by_host_status', q => q.eq('hostId', user._id).eq('status', 'PENDING'))
      .collect();

    const requesterIds = Array.from(new Set(requests.map(request => request.userId)));
    const activityIds = Array.from(new Set(requests.map(request => request.activityId)));

    const [requesters, activities] = await Promise.all([
      Promise.all(requesterIds.map(id => ctx.db.get('users', id))),
      Promise.all(activityIds.map(id => ctx.db.get('activities', id)))
    ]);

    const requesterById = new Map(requesters.filter(Boolean).map(r => [r!._id, r!]));
    const activityById = new Map(activities.filter(Boolean).map(a => [a!._id, a!]));

    const results: Array<{
      request: (typeof requests)[number];
      requester: {
        _id: (typeof requests)[number]['userId'];
        username: string;
        firstName?: string;
        lastName?: string;
        profileUrl?: string;
      };
      activity: { _id: (typeof requests)[number]['activityId']; title: string };
    }> = [];

    for (const request of requests) {
      const requester = requesterById.get(request.userId);
      const activity = activityById.get(request.activityId);

      if (requester && activity) {
        results.push({
          request,
          requester: {
            _id: requester._id,
            username: requester.username,
            firstName: requester.firstName,
            lastName: requester.lastName,
            profileUrl: requester.profileUrl
          },
          activity: {
            _id: activity._id,
            title: activity.title
          }
        });
      }
    }

    return results;
  }
});

/**
 * Get requests made by the current user.
 */
export const getMyRequests = zQuery({
  args: {
    status: requestStatusSchema.optional()
  },
  returns: z.array(
    z.object({
      request: requestSchema,
      activity: z.object({
        _id: zid('activities'),
        title: z.string(),
        sport: sportTypeSchema
      })
    })
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    let requests;
    if (args.status) {
      requests = await ctx.db
        .query('requests')
        .withIndex('by_user_status', q => q.eq('userId', user._id).eq('status', args.status!))
        .collect();
    } else {
      // Get all requests for user
      const allRequests = await ctx.db
        .query('requests')
        .withIndex('by_user_status', q => q.eq('userId', user._id))
        .collect();
      requests = allRequests;
    }

    const activityIds = Array.from(new Set(requests.map(request => request.activityId)));
    const activities = await Promise.all(activityIds.map(id => ctx.db.get('activities', id)));
    const activityById = new Map(activities.filter(Boolean).map(a => [a!._id, a!]));

    const results: Array<{
      request: (typeof requests)[number];
      activity: {
        _id: (typeof requests)[number]['activityId'];
        title: string;
        sport: 'Padel' | 'Pickleball';
      };
    }> = [];

    for (const request of requests) {
      const activity = activityById.get(request.activityId);
      if (activity) {
        results.push({
          request,
          activity: {
            _id: activity._id,
            title: activity.title,
            sport: activity.sport
          }
        });
      }
    }

    return results;
  }
});

/**
 * Get requests made by the current user (paginated).
 */
export const getMyRequestsPaginated = zQuery({
  args: {
    status: requestStatusSchema.optional(),
    paginationOpts: paginationOptsSchema
  },
  returns: z.object({
    page: z.array(
      z.object({
        request: requestSchema,
        activity: z.object({
          _id: zid('activities'),
          title: z.string(),
          sport: sportTypeSchema
        })
      })
    ),
    isDone: z.boolean(),
    continueCursor: z.string().nullable()
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: null };
    }

    const requestPage = args.status
      ? await ctx.db
          .query('requests')
          .withIndex('by_user_status', q => q.eq('userId', user._id).eq('status', args.status!))
          .order('desc')
          .paginate(args.paginationOpts)
      : await ctx.db
          .query('requests')
          .withIndex('by_user_status', q => q.eq('userId', user._id))
          .order('desc')
          .paginate(args.paginationOpts);

    const activityIds = Array.from(new Set(requestPage.page.map(request => request.activityId)));
    const activities = await Promise.all(activityIds.map(id => ctx.db.get('activities', id)));
    const activityById = new Map(activities.filter(Boolean).map(a => [a!._id, a!]));

    return {
      page: requestPage.page.flatMap(request => {
        const activity = activityById.get(request.activityId);
        if (!activity) {
          return [];
        }

        return [
          {
            request,
            activity: {
              _id: activity._id,
              title: activity.title,
              sport: activity.sport
            }
          }
        ];
      }),
      isDone: requestPage.isDone,
      continueCursor: requestPage.continueCursor
    };
  }
});

/**
 * Approve a join request.
 */
export const approveRequest = zMutation({
  args: {
    requestId: zid('requests')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const request = await ctx.db.get('requests', args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.hostId !== userId) {
      throw new Error('Not authorized to approve this request');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Request is not pending');
    }

    const activity = await ctx.db.get('activities', request.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check capacity
    if (activity.joinedCount >= activity.requirements.slotsTotal) {
      throw new Error('Activity is full');
    }

    const now = Date.now();

    // Update request
    await ctx.db.patch('requests', args.requestId, {
      status: 'APPROVED',
      respondedAt: now
    });

    // Add as participant
    const existingParticipant = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity_user', q => q.eq('activityId', request.activityId).eq('userId', request.userId))
      .unique();

    if (existingParticipant) {
      await ctx.db.patch('activityParticipants', existingParticipant._id, {
        status: 'JOINED',
        joinedVia: 'REQUEST'
      });
    } else {
      await ctx.db.insert('activityParticipants', {
        activityId: request.activityId,
        userId: request.userId,
        status: 'JOINED',
        joinedVia: 'REQUEST'
      });
    }

    // Update activity joined count
    const newCount = activity.joinedCount + 1;
    const activityUpdates: { joinedCount: number; status?: 'FILLED'; updatedAt: number } = {
      joinedCount: newCount,
      updatedAt: now
    };

    if (newCount >= activity.requirements.slotsTotal) {
      activityUpdates.status = 'FILLED';
    }

    await ctx.db.patch('activities', request.activityId, activityUpdates);
    await syncActivityConversation(ctx, { activityId: request.activityId, actorUserId: request.userId });

    const host = await ctx.db.get('users', userId);

    // Notify requester
    await ctx.db.insert('notifications', {
      userId: request.userId,
      type: 'APPROVED',
      title: 'Request Approved',
      body: 'Your join request has been approved!',
      read: false,
      data: {
        requestId: args.requestId,
        activityId: request.activityId,
        actorUserId: userId,
        actorUsername: host?.username
      }
    });

    await incrementUnreadCount(ctx, request.userId);

    return null;
  }
});

/**
 * Reject a join request.
 */
export const rejectRequest = zMutation({
  args: {
    requestId: zid('requests')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const request = await ctx.db.get('requests', args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.hostId !== userId) {
      throw new Error('Not authorized to reject this request');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Request is not pending');
    }

    await ctx.db.patch('requests', args.requestId, {
      status: 'REJECTED',
      respondedAt: Date.now()
    });

    const host = await ctx.db.get('users', userId);

    // Notify requester
    await ctx.db.insert('notifications', {
      userId: request.userId,
      type: 'REJECTED',
      title: 'Request Declined',
      body: 'Your join request was not accepted',
      read: false,
      data: {
        requestId: args.requestId,
        activityId: request.activityId,
        actorUserId: userId,
        actorUsername: host?.username
      }
    });

    await incrementUnreadCount(ctx, request.userId);

    return null;
  }
});

/**
 * Cancel a pending request (by requester).
 */
export const cancelRequest = zMutation({
  args: {
    requestId: zid('requests')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const request = await ctx.db.get('requests', args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.userId !== userId) {
      throw new Error('Not authorized to cancel this request');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Can only cancel pending requests');
    }

    await ctx.db.delete('requests', args.requestId);
    return null;
  }
});
