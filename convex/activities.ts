import { z } from 'zod';

import type { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import { enrichActivitiesWithCreators } from './lib/helpers';
import { syncActivityConversation } from './lib/activityChats';
import {
  SKILL_RANGES,
  activityStatusSchema,
  joinedViaSchema,
  participantStatusSchema,
  sportTypeSchema
} from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import {
  activityLocationSchema,
  activityRequirementsSchema,
  activitySchema,
  activityWithCreatorSchema,
  paginationOptsSchema,
  requirementsUpdateSchema
} from './lib/zodSchemas';
import { getCurrentAuthenticatedUser, requireUser } from './users';

/**
 * Create a new activity (game).
 */
export const createActivity = zMutation({
  args: {
    sport: sportTypeSchema,
    title: z.string(),
    description: z.string().optional(),
    location: activityLocationSchema,
    startTime: z.number(),
    endTime: z.number().optional(),
    requirements: activityRequirementsSchema,
    broadcast: z.boolean().optional()
  },
  returns: zid('activities'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Validate level range
    const range = SKILL_RANGES[args.sport];
    if (args.requirements.levelMin < range.min || args.requirements.levelMax > range.max) {
      throw new Error(`Level range for ${args.sport} must be between ${range.min} and ${range.max}`);
    }
    if (args.requirements.levelMin > args.requirements.levelMax) {
      throw new Error('Min level cannot be greater than max level');
    }

    if (!args.location.clubId) {
      throw new Error('Club is required for creating a game');
    }

    // If clubId provided, verify it exists and get city
    let locationCity = args.location.city;
    if (args.location.clubId) {
      const club = await ctx.db.get('clubs', args.location.clubId);
      if (!club) {
        throw new Error('Club not found');
      }
      // Override city with club's city for consistency
      locationCity = club.city;
    }

    const now = Date.now();

    const activityId = await ctx.db.insert('activities', {
      creatorId: userId,
      sport: args.sport,
      title: args.title,
      description: args.description,
      status: 'OPEN',
      location: {
        ...args.location,
        city: locationCity
      },
      startTime: args.startTime,
      endTime: args.endTime,
      requirements: args.requirements,
      joinedCount: 1, // Creator counts as first participant
      broadcastSentAt: args.broadcast ? now : undefined,
      updatedAt: now
    });

    // Add creator as participant
    await ctx.db.insert('activityParticipants', {
      activityId,
      userId,
      status: 'JOINED',
      joinedVia: 'CREATOR'
    });

    // Schedule alert processing (async)
    await ctx.scheduler.runAfter(0, api.alerts.processActivityAlerts, { activityId });

    return activityId;
  }
});

/**
 * Get a single activity by ID.
 */
export const getActivity = zQuery({
  args: {
    activityId: zid('activities')
  },
  returns: activitySchema.nullable(),
  handler: async (ctx, args) => {
    return await ctx.db.get('activities', args.activityId);
  }
});

/**
 * Get activity with creator details.
 */
export const getActivityWithCreator = zQuery({
  args: {
    activityId: zid('activities')
  },
  returns: activityWithCreatorSchema.nullable(),
  handler: async (ctx, args) => {
    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      return null;
    }

    const creator = await ctx.db.get('users', activity.creatorId);
    if (!creator) {
      return null;
    }

    return {
      activity,
      creator: {
        _id: creator._id,
        username: creator.username
      }
    };
  }
});

/**
 * List open activities by sport and city.
 * Used for the "What can I join?" feature.
 */
export const listActivities = zQuery({
  args: {
    sport: sportTypeSchema.optional(),
    city: z.string().optional(),
    status: activityStatusSchema.optional(),
    limit: z.number().optional()
  },
  returns: z.array(activityWithCreatorSchema),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const status = args.status ?? 'OPEN';

    let activities;

    if (args.sport && args.city) {
      activities = await ctx.db
        .query('activities')
        .withIndex('by_sport_city_status', q =>
          q.eq('sport', args.sport!).eq('location.city', args.city!).eq('status', status)
        )
        .order('desc')
        .take(limit);
    } else if (args.sport) {
      // Use by_sport_status index
      activities = await ctx.db
        .query('activities')
        .withIndex('by_sport_status', q => q.eq('sport', args.sport!).eq('status', status))
        .order('desc')
        .take(limit);
    } else {
      activities = await ctx.db
        .query('activities')
        .withIndex('by_status', q => q.eq('status', status))
        .order('desc')
        .take(limit);
    }

    return await enrichActivitiesWithCreators(ctx.db, activities);
  }
});

/**
 * List open activities by sport and club.
 * Used for the dashboard/finder "What games can I join?" bucket.
 */
export const listActivitiesByClub = zQuery({
  args: {
    sport: sportTypeSchema,
    clubId: zid('clubs'),
    status: activityStatusSchema.optional(),
    afterTime: z.number().optional(),
    limit: z.number().optional()
  },
  returns: z.array(activityWithCreatorSchema),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const status = args.status ?? 'OPEN';
    const afterTime = args.afterTime ?? Date.now();

    const activities = await ctx.db
      .query('activities')
      .withIndex('by_sport_club_status_startTime', q =>
        q.eq('sport', args.sport).eq('location.clubId', args.clubId).eq('status', status).gte('startTime', afterTime)
      )
      .order('asc')
      .take(limit);

    return await enrichActivitiesWithCreators(ctx.db, activities);
  }
});

/**
 * List activities created by the current user.
 */
export const listMyActivities = zQuery({
  args: {
    status: activityStatusSchema.optional()
  },
  returns: z.array(activitySchema),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Use by_creator_status index when filtering by status
    if (args.status) {
      return await ctx.db
        .query('activities')
        .withIndex('by_creator_status', q => q.eq('creatorId', user._id).eq('status', args.status!))
        .order('desc')
        .collect();
    }

    return await ctx.db
      .query('activities')
      .withIndex('by_creator', q => q.eq('creatorId', user._id))
      .order('desc')
      .collect();
  }
});

/**
 * List activities created by the current user (paginated).
 */
export const listMyActivitiesPaginated = zQuery({
  args: {
    status: activityStatusSchema.optional(),
    paginationOpts: paginationOptsSchema
  },
  returns: z.object({
    page: z.array(activitySchema),
    isDone: z.boolean(),
    continueCursor: z.string().nullable()
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: null };
    }

    if (args.status) {
      return await ctx.db
        .query('activities')
        .withIndex('by_creator_status', q => q.eq('creatorId', user._id).eq('status', args.status!))
        .order('desc')
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query('activities')
      .withIndex('by_creator', q => q.eq('creatorId', user._id))
      .order('desc')
      .paginate(args.paginationOpts);
  }
});

/**
 * List upcoming activities (by start time).
 */
export const listUpcomingActivities = zQuery({
  args: {
    sport: sportTypeSchema.optional(),
    afterTime: z.number().optional(),
    limit: z.number().optional()
  },
  returns: z.array(activityWithCreatorSchema),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const afterTime = args.afterTime ?? Date.now();

    let activities;

    if (args.sport) {
      activities = await ctx.db
        .query('activities')
        .withIndex('by_sport_status_startTime', q =>
          q.eq('sport', args.sport!).eq('status', 'OPEN').gte('startTime', afterTime)
        )
        .order('asc')
        .take(limit);
    } else {
      // Use by_status_startTime for efficient range query
      activities = await ctx.db
        .query('activities')
        .withIndex('by_status_startTime', q => q.eq('status', 'OPEN').gte('startTime', afterTime))
        .order('asc')
        .take(limit);
    }

    return await enrichActivitiesWithCreators(ctx.db, activities);
  }
});

/**
 * Update activity status.
 */
export const updateActivityStatus = zMutation({
  args: {
    activityId: zid('activities'),
    status: activityStatusSchema
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.creatorId !== userId) {
      throw new Error('Not authorized to update this activity');
    }

    await ctx.db.patch('activities', args.activityId, {
      status: args.status,
      updatedAt: Date.now()
    });
    return null;
  }
});

/**
 * Update activity details.
 */
export const updateActivity = zMutation({
  args: {
    activityId: zid('activities'),
    title: z.string().optional(),
    description: z.string().optional(),
    location: activityLocationSchema.optional(),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
    requirements: requirementsUpdateSchema.optional()
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.creatorId !== userId) {
      throw new Error('Not authorized to update this activity');
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startTime !== undefined) updates.startTime = args.startTime;
    if (args.endTime !== undefined) updates.endTime = args.endTime;

    if (args.location !== undefined) {
      // If clubId changed, update city from club
      let location = args.location;
      if (args.location.clubId) {
        const club = await ctx.db.get('clubs', args.location.clubId);
        if (club) {
          location = { ...args.location, city: club.city };
        }
      }
      updates.location = location;
    }

    if (args.requirements !== undefined) {
      updates.requirements = {
        ...activity.requirements,
        ...args.requirements
      };
    }

    await ctx.db.patch('activities', args.activityId, updates);
    return null;
  }
});

/**
 * Cancel an activity.
 */
export const cancelActivity = zMutation({
  args: {
    activityId: zid('activities')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.creatorId !== userId) {
      throw new Error('Not authorized to cancel this activity');
    }

    await ctx.db.patch('activities', args.activityId, {
      status: 'CANCELLED',
      updatedAt: Date.now()
    });

    await syncActivityConversation(ctx, { activityId: args.activityId, actorUserId: userId });
    return null;
  }
});

/**
 * Join a game directly (for open activities or broadcast responses).
 */
export const joinActivity = zMutation({
  args: {
    activityId: zid('activities'),
    joinedVia: joinedViaSchema.optional()
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.status !== 'OPEN') {
      throw new Error('Activity is not open for joining');
    }

    // Check if already a participant
    const existing = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity_user', q => q.eq('activityId', args.activityId).eq('userId', userId))
      .unique();

    if (existing && existing.status === 'JOINED') {
      throw new Error('Already joined this activity');
    }

    // Check capacity
    if (activity.joinedCount >= activity.requirements.slotsTotal) {
      throw new Error('Activity is full');
    }

    const now = Date.now();

    // Insert or update participant
    if (existing) {
      await ctx.db.patch('activityParticipants', existing._id, {
        status: 'JOINED',
        joinedVia: args.joinedVia ?? 'REQUEST'
      });
    } else {
      await ctx.db.insert('activityParticipants', {
        activityId: args.activityId,
        userId,
        status: 'JOINED',
        joinedVia: args.joinedVia ?? 'REQUEST'
      });
    }

    // Update joined count
    const newCount = activity.joinedCount + 1;
    const updates: { joinedCount: number; status?: 'FILLED'; updatedAt: number } = {
      joinedCount: newCount,
      updatedAt: now
    };

    if (newCount >= activity.requirements.slotsTotal) {
      updates.status = 'FILLED';
    }

    await ctx.db.patch('activities', args.activityId, updates);
    await syncActivityConversation(ctx, { activityId: args.activityId, actorUserId: userId });
    return null;
  }
});

/**
 * Leave an activity.
 */
export const leaveActivity = zMutation({
  args: {
    activityId: zid('activities')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Can't leave if you're the creator
    if (activity.creatorId === userId) {
      throw new Error('Creator cannot leave. Cancel the activity instead.');
    }

    const participant = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity_user', q => q.eq('activityId', args.activityId).eq('userId', userId))
      .unique();

    if (!participant || participant.status !== 'JOINED') {
      throw new Error('Not a participant of this activity');
    }

    const now = Date.now();

    // Update participant status to LEFT
    await ctx.db.patch('activityParticipants', participant._id, { status: 'LEFT' });

    const request = await ctx.db
      .query('requests')
      .withIndex('by_activity_user', q => q.eq('activityId', args.activityId).eq('userId', userId))
      .unique();

    if (request?.status === 'APPROVED') {
      await ctx.db.patch('requests', request._id, {
        status: 'CANCELLED',
        respondedAt: now
      });
    }

    // Update joined count
    const newCount = Math.max(0, activity.joinedCount - 1);
    const updates: { joinedCount: number; status?: 'OPEN'; updatedAt: number } = {
      joinedCount: newCount,
      updatedAt: now
    };

    // Reopen if activity was filled
    if (activity.status === 'FILLED') {
      updates.status = 'OPEN';
    }

    await ctx.db.patch('activities', args.activityId, updates);
    await syncActivityConversation(ctx, { activityId: args.activityId, actorUserId: userId });
    return null;
  }
});

/**
 * Get participants for an activity.
 */
export const getActivityParticipants = zQuery({
  args: {
    activityId: zid('activities')
  },
  returns: z.array(
    z.object({
      _id: zid('activityParticipants'),
      userId: zid('users'),
      username: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      profileUrl: z.string().optional(),
      status: participantStatusSchema,
      joinedVia: joinedViaSchema.optional()
    })
  ),
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query('activityParticipants')
      .withIndex('by_activity', q => q.eq('activityId', args.activityId))
      .collect();

    const participantIds = Array.from(new Set(participants.map(p => p.userId)));
    const participantUsers = await Promise.all(participantIds.map(id => ctx.db.get('users', id)));
    const participantById = new Map(participantUsers.filter(Boolean).map(user => [user!._id, user!]));

    const results: Array<{
      _id: (typeof participants)[number]['_id'];
      userId: (typeof participants)[number]['userId'];
      username: string;
      firstName?: string;
      lastName?: string;
      profileUrl?: string;
      status: (typeof participants)[number]['status'];
      joinedVia: (typeof participants)[number]['joinedVia'];
    }> = [];

    for (const p of participants) {
      const user = participantById.get(p.userId);
      if (user) {
        results.push({
          _id: p._id,
          userId: p.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profileUrl: user.profileUrl,
          status: p.status,
          joinedVia: p.joinedVia
        });
      }
    }

    return results;
  }
});

const myUpcomingActivitySchema = activityWithCreatorSchema.extend({
  participantStatus: z.enum(['JOINED', 'PENDING']),
  requestId: zid('requests').nullable()
});

/**
 * Get activities that the current user is a participant in (excluding those they host).
 * Returns upcoming JOINED and PENDING activities sorted by start time.
 */
export const listMyUpcomingActivities = zQuery({
  args: {
    limit: z.number().optional(),
    afterTime: z.number().optional()
  },
  returns: z.array(myUpcomingActivitySchema),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 10;
    const afterTime = args.afterTime ?? Date.now();

    const joinedParticipations = await ctx.db
      .query('activityParticipants')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .filter(q => q.eq(q.field('status'), 'JOINED'))
      .collect();

    const pendingRequests = await ctx.db
      .query('requests')
      .withIndex('by_user_status', q => q.eq('userId', user._id).eq('status', 'PENDING'))
      .collect();

    if (joinedParticipations.length === 0 && pendingRequests.length === 0) {
      return [];
    }

    const stateByActivityId = new Map<
      Id<'activities'>,
      {
        participantStatus: 'JOINED' | 'PENDING';
        requestId: Id<'requests'> | null;
      }
    >();

    for (const participation of joinedParticipations) {
      stateByActivityId.set(participation.activityId, {
        participantStatus: 'JOINED',
        requestId: null
      });
    }

    for (const request of pendingRequests) {
      if (!stateByActivityId.has(request.activityId)) {
        stateByActivityId.set(request.activityId, {
          participantStatus: 'PENDING',
          requestId: request._id
        });
      }
    }

    const activityIds = Array.from(stateByActivityId.keys());
    const fetchedActivities = await Promise.all(activityIds.map(id => ctx.db.get('activities', id)));

    const upcomingActivities = fetchedActivities
      .filter(
        (a): a is (typeof fetchedActivities)[0] & {} =>
          a != null &&
          a.creatorId !== user._id &&
          a.startTime >= afterTime &&
          a.status !== 'CANCELLED' &&
          a.status !== 'COMPLETED'
      )
      .sort((a, b) => (a?.startTime ?? 0) - (b?.startTime ?? 0))
      .slice(0, limit);

    const enriched = await enrichActivitiesWithCreators(ctx.db, upcomingActivities);

    return enriched.flatMap(item => {
      const state = stateByActivityId.get(item.activity._id);
      if (!state) {
        return [];
      }

      return [
        {
          ...item,
          participantStatus: state.participantStatus,
          requestId: state.requestId
        }
      ];
    });
  }
});
