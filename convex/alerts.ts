import { z } from 'zod';

import { sportTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery, zid } from './lib/zodHelpers';
import { alertFiltersSchema, alertSchema } from './lib/zodSchemas';
import { getCurrentAuthenticatedUser, requireUser } from './users';

/**
 * Create or update an alert for the current user.
 */
export const upsertAlert = zMutation({
  args: {
    sport: sportTypeSchema,
    active: z.boolean(),
    filters: alertFiltersSchema
  },
  returns: zid('alerts'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Check if user already has an alert for this sport/city combination
    const existingAlerts = await ctx.db
      .query('alerts')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const existing = existingAlerts.find(a => a.sport === args.sport && a.filters.city === args.filters.city);

    if (existing) {
      await ctx.db.patch('alerts', existing._id, {
        active: args.active,
        filters: args.filters
      });
      return existing._id;
    }

    const alertId = await ctx.db.insert('alerts', {
      userId,
      sport: args.sport,
      active: args.active,
      filters: args.filters,
      lastAlertSentAt: undefined,
      alertCountToday: 0
    });

    return alertId;
  }
});

/**
 * Create a new alert.
 */
export const createAlert = zMutation({
  args: {
    sport: sportTypeSchema,
    filters: alertFiltersSchema
  },
  returns: zid('alerts'),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const alertId = await ctx.db.insert('alerts', {
      userId,
      sport: args.sport,
      active: true,
      filters: args.filters,
      lastAlertSentAt: undefined,
      alertCountToday: 0
    });

    return alertId;
  }
});

/**
 * Get all alerts for the current user.
 */
export const getMyAlerts = zQuery({
  args: {},
  returns: z.array(alertSchema),
  handler: async ctx => {
    const user = await getCurrentAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query('alerts')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect();
  }
});

/**
 * Get a specific alert.
 */
export const getAlert = zQuery({
  args: {
    alertId: zid('alerts')
  },
  returns: alertSchema.nullable(),
  handler: async (ctx, args) => {
    return await ctx.db.get('alerts', args.alertId);
  }
});

/**
 * Toggle an alert on/off.
 */
export const toggleAlert = zMutation({
  args: {
    alertId: zid('alerts')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const alert = await ctx.db.get('alerts', args.alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.userId !== userId) {
      throw new Error('Not authorized to modify this alert');
    }

    await ctx.db.patch('alerts', args.alertId, { active: !alert.active });
    return null;
  }
});

/**
 * Update alert filters.
 */
export const updateAlert = zMutation({
  args: {
    alertId: zid('alerts'),
    active: z.boolean().optional(),
    filters: alertFiltersSchema.optional()
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const alert = await ctx.db.get('alerts', args.alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.userId !== userId) {
      throw new Error('Not authorized to modify this alert');
    }

    const updates: { active?: boolean; filters?: typeof args.filters } = {};
    if (args.active !== undefined) updates.active = args.active;
    if (args.filters !== undefined) updates.filters = args.filters;

    await ctx.db.patch('alerts', args.alertId, updates);
    return null;
  }
});

/**
 * Delete an alert.
 */
export const deleteAlert = zMutation({
  args: {
    alertId: zid('alerts')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const alert = await ctx.db.get('alerts', args.alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.userId !== userId) {
      throw new Error('Not authorized to delete this alert');
    }

    await ctx.db.delete('alerts', args.alertId);
    return null;
  }
});

/**
 * Find alerts that match a new activity.
 * Used to notify users when a matching game is posted.
 */
export const findMatchingAlerts = zQuery({
  args: {
    sport: sportTypeSchema,
    city: z.string(),
    levelMin: z.number(),
    levelMax: z.number(),
    clubId: zid('clubs').optional()
  },
  returns: z.array(
    z.object({
      alertId: zid('alerts'),
      userId: zid('users')
    })
  ),
  handler: async (ctx, args) => {
    // Query alerts by sport+city+active index
    const alerts = await ctx.db
      .query('alerts')
      .withIndex('by_sport_city_active', q =>
        q.eq('sport', args.sport).eq('filters.city', args.city).eq('active', true)
      )
      .collect();

    // Filter by level and club in JS
    const matchingAlerts = alerts.filter(alert => {
      // Check level range overlap
      const alertLevelMin = alert.filters.levelMin ?? 0;
      const alertLevelMax = alert.filters.levelMax ?? 10;

      const levelsOverlap = args.levelMin <= alertLevelMax && args.levelMax >= alertLevelMin;

      if (!levelsOverlap) {
        return false;
      }

      // Check club filter
      if (alert.filters.clubId && args.clubId && alert.filters.clubId !== args.clubId) {
        return false;
      }

      return true;
    });

    return matchingAlerts.map(a => ({
      alertId: a._id,
      userId: a.userId
    }));
  }
});
/**
 * Sync a passport alert with sport profile data.
 * This is called automatically when a sport profile is updated.
 */
export const syncPassportAlert = zMutation({
  args: {
    profileId: zid('userSportProfiles')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get('userSportProfiles', args.profileId);
    if (!profile) return null;

    if (!profile.homeClubId) return null;

    const club = await ctx.db.get('clubs', profile.homeClubId);
    if (!club) {
      console.warn(`Home club ${profile.homeClubId} not found for profile ${args.profileId}`);
      return null;
    }

    if (profile.skillLevel === undefined) return null;

    const MAX_RATING = 7;
    const tolerance = profile.matchingTolerance ?? 0.2;
    const levelMin = profile.skillLevel * (1 - tolerance);
    const levelMax = Math.min(profile.skillLevel * (1 + tolerance), MAX_RATING);

    const existingAlert = await ctx.db
      .query('alerts')
      .withIndex('by_user', q => q.eq('userId', profile.userId))
      .filter(q => q.eq(q.field('isPassport'), true))
      .filter(q => q.eq(q.field('sport'), profile.sport))
      .unique();

    const filters = {
      city: (club as { city: string }).city,
      levelMin,
      levelMax,
      clubId: profile.homeClubId
    };

    if (existingAlert) {
      await ctx.db.patch('alerts', existingAlert._id, {
        active: profile.isActive,
        profileId: profile._id,
        filters
      });
    } else {
      await ctx.db.insert('alerts', {
        userId: profile.userId,
        profileId: profile._id,
        sport: profile.sport,
        active: profile.isActive,
        isPassport: true,
        filters,
        lastAlertSentAt: undefined,
        alertCountToday: 0
      });
    }

    return null;
  }
});

/**
 * Process alerts for a newly created activity.
 * Creates notifications for users with matching alerts.
 *
 * Matching logic (Club-only as per requirements):
 * 1. Activity must be linked to a club.
 * 2. Alert must match sport + clubId + active.
 * 3. User's skill level must overlap with activity requirements.
 */
export const processActivityAlerts = zMutation({
  args: {
    activityId: zid('activities')
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    // 1. Get the activity
    const activity = await ctx.db.get('activities', args.activityId);
    if (!activity) {
      console.warn(`Activity ${args.activityId} not found during alert processing`);
      return null;
    }

    // 2. Check for club (Early return if not club-based)
    if (!activity.location.clubId) {
      return null;
    }

    // 3. Query matching alerts (Sport + Club + Active)
    const alerts = await ctx.db
      .query('alerts')
      .withIndex('by_sport_club_active', q =>
        q.eq('sport', activity.sport).eq('filters.clubId', activity.location.clubId!).eq('active', true)
      )
      .collect();

    if (alerts.length === 0) {
      return null;
    }

    const now = Date.now();
    const creator = await ctx.db.get('users', activity.creatorId);

    // 4. Filter by Level and Process
    for (const alert of alerts) {
      // Exclude creator
      if (alert.userId === activity.creatorId) {
        continue;
      }

      // Check level overlap
      const alertMin = alert.filters.levelMin ?? 0;
      const alertMax = alert.filters.levelMax ?? 10;
      const activityMin = activity.requirements.levelMin;
      const activityMax = activity.requirements.levelMax;

      const hasOverlap = alertMin <= activityMax && alertMax >= activityMin;

      if (hasOverlap) {
        // Create Notification
        await ctx.db.insert('notifications', {
          userId: alert.userId,
          type: 'ACTIVITY_ALERT',
          title: 'New Game Match!',
          body: `A new ${activity.sport} game matches your preferences.`,
          read: false,
          data: {
            activityId: activity._id,
            alertId: alert._id,
            clubId: activity.location.clubId,
            actorUserId: activity.creatorId,
            actorUsername: creator?.username
          }
        });

        // Update stats
        await ctx.db.patch('alerts', alert._id, {
          lastAlertSentAt: now,
          alertCountToday: (alert.alertCountToday ?? 0) + 1
        });

        // Increment user unread count
        const user = await ctx.db.get('users', alert.userId);
        if (user) {
          const currentCount = user.unreadNotificationCount ?? 0;
          await ctx.db.patch('users', alert.userId, { unreadNotificationCount: currentCount + 1 });
        }
      }
    }

    return null;
  }
});
