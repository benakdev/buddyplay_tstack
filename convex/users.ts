import { z } from 'zod';

import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { zInternalMutation, zMutation, zQuery, zid } from './lib/zodHelpers';
import { clerkProfileSyncSchema, userSchema, userUpdateSchema } from './lib/zodSchemas';

const DELETED_FIRST_NAME = 'Deleted';
const DELETED_LAST_NAME = 'User';
const DELETED_USERNAME_PREFIX = 'deleteduser';

function getIdentityStringField(identity: Record<string, unknown>, key: string): string | undefined {
  const value = identity[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getDeletedUsername(userId: Id<'users'>): string {
  return `${DELETED_USERNAME_PREFIX}${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toLowerCase()}`;
}

function getDeletedTokenIdentifier(userId: Id<'users'>, deletedAt: number): string {
  return `deleted:${userId}:${deletedAt}`;
}

function isDeletedUser(user: { deletedAt?: number | undefined } | null | undefined): boolean {
  return user?.deletedAt !== undefined;
}

function isFutureActivity(timestamp: number, deletedAt: number) {
  return timestamp >= deletedAt;
}

function isActiveFutureParticipationStatus(status: 'JOINED' | 'INVITED' | 'LEFT' | 'REMOVED') {
  return status === 'JOINED' || status === 'INVITED';
}

async function cancelRequestIfActive(ctx: MutationCtx, requestId: Id<'requests'>, deletedAt: number) {
  const request = await ctx.db.get('requests', requestId);
  if (!request || (request.status !== 'PENDING' && request.status !== 'APPROVED')) {
    return;
  }

  await ctx.db.patch('requests', request._id, {
    status: 'CANCELLED',
    respondedAt: deletedAt
  });
}

async function removeUserFromFutureActivities(ctx: MutationCtx, userId: Id<'users'>, deletedAt: number) {
  const participations = await ctx.db
    .query('activityParticipants')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();

  for (const participation of participations) {
    if (!isActiveFutureParticipationStatus(participation.status)) {
      continue;
    }

    const activity = await ctx.db.get('activities', participation.activityId);
    if (!activity || activity.creatorId === userId || !isFutureActivity(activity.startTime, deletedAt)) {
      continue;
    }

    const previousStatus = participation.status;

    await ctx.db.patch('activityParticipants', participation._id, {
      status: 'REMOVED'
    });

    if (previousStatus === 'JOINED') {
      const nextJoinedCount = Math.max(0, activity.joinedCount - 1);
      const activityUpdates: {
        joinedCount: number;
        updatedAt: number;
        status?: 'OPEN';
      } = {
        joinedCount: nextJoinedCount,
        updatedAt: deletedAt
      };

      if (activity.status === 'FILLED' && nextJoinedCount < activity.requirements.slotsTotal) {
        activityUpdates.status = 'OPEN';
      }

      await ctx.db.patch('activities', activity._id, activityUpdates);
    }

    const request = await ctx.db
      .query('requests')
      .withIndex('by_activity_user', q => q.eq('activityId', participation.activityId).eq('userId', userId))
      .unique();

    if (request) {
      await cancelRequestIfActive(ctx, request._id, deletedAt);
    }
  }
}

async function finalizeUserDeletion(ctx: MutationCtx, userId: Id<'users'>, requestedDeletedAt: number) {
  const user = await ctx.db.get('users', userId);
  if (!user) {
    throw new Error('User not found');
  }

  const deletedAt = user.deletedAt ?? requestedDeletedAt;

  const [alerts, notifications, sportProfiles, createdActivities, pendingRequests] = await Promise.all([
    ctx.db
      .query('alerts')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect(),
    ctx.db
      .query('notifications')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect(),
    ctx.db
      .query('userSportProfiles')
      .withIndex('by_user_id', q => q.eq('userId', user._id))
      .collect(),
    ctx.db
      .query('activities')
      .withIndex('by_creator', q => q.eq('creatorId', user._id))
      .collect(),
    ctx.db
      .query('requests')
      .withIndex('by_user_status', q => q.eq('userId', user._id).eq('status', 'PENDING'))
      .collect()
  ]);

  for (const alert of alerts) {
    await ctx.db.delete('alerts', alert._id);
  }

  for (const notification of notifications) {
    await ctx.db.delete('notifications', notification._id);
  }

  for (const profile of sportProfiles) {
    await ctx.db.delete('userSportProfiles', profile._id);
  }

  for (const activity of createdActivities) {
    if ((activity.status === 'OPEN' || activity.status === 'FILLED') && isFutureActivity(activity.startTime, deletedAt)) {
      await ctx.db.patch('activities', activity._id, {
        status: 'CANCELLED',
        updatedAt: deletedAt
      });

      const activityRequests = await ctx.db
        .query('requests')
        .withIndex('by_activity', q => q.eq('activityId', activity._id))
        .collect();

      for (const request of activityRequests) {
        if (request.status === 'PENDING') {
          await ctx.db.patch('requests', request._id, {
            status: 'CANCELLED',
            respondedAt: deletedAt
          });
        }
      }
    }
  }

  await removeUserFromFutureActivities(ctx, user._id, deletedAt);

  for (const request of pendingRequests) {
    const activity = await ctx.db.get('activities', request.activityId);
    if (!activity || !isFutureActivity(activity.startTime, deletedAt)) {
      continue;
    }

    await cancelRequestIfActive(ctx, request._id, deletedAt);
  }

  await ctx.db.patch('users', user._id, {
    tokenIdentifier: getDeletedTokenIdentifier(user._id, deletedAt),
    username: getDeletedUsername(user._id),
    firstName: DELETED_FIRST_NAME,
    lastName: DELETED_LAST_NAME,
    profileUrl: undefined,
    deletedAt,
    gender: undefined,
    age: undefined,
    dominantHand: undefined,
    bio: undefined,
    location: undefined,
    unreadNotificationCount: 0,
    privacySettings: undefined
  });

  return {
    userId: user._id,
    deletedAt
  };
}

async function getUserByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
  options?: { includeDeleted?: boolean }
) {
  const user = await ctx.db
    .query('users')
    .withIndex('by_token', q => q.eq('tokenIdentifier', tokenIdentifier))
    .unique();

  if (!user) {
    return null;
  }

  if (!options?.includeDeleted && isDeletedUser(user)) {
    return null;
  }

  return user;
}

export async function getCurrentAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
  options?: { includeDeleted?: boolean }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return await getUserByTokenIdentifier(ctx, identity.tokenIdentifier, options);
}

function getClerkProfileSnapshot(identity: Record<string, unknown>) {
  const firstName = getIdentityStringField(identity, 'givenName');
  const lastName = getIdentityStringField(identity, 'familyName');
  const name = getIdentityStringField(identity, 'name');

  return {
    firstName: firstName ?? name?.split(/\s+/).at(0),
    lastName: lastName ?? (name ? name.split(/\s+/).slice(1).join(' ').trim() || undefined : undefined),
    profileUrl: getIdentityStringField(identity, 'pictureUrl')
  };
}

async function syncClerkProfileToUser(
  ctx: MutationCtx,
  userId: Id<'users'>,
  identity: Record<string, unknown>
) {
  const clerkProfile = getClerkProfileSnapshot(identity);

  await ctx.db.patch('users', userId, {
    firstName: clerkProfile.firstName,
    lastName: clerkProfile.lastName,
    profileUrl: clerkProfile.profileUrl
  });

  const updatedUser = await ctx.db.get('users', userId);
  if (!updatedUser) {
    throw new Error('Failed to sync user profile');
  }

  return updatedUser;
}

async function patchClerkProfileOnUser(
  ctx: MutationCtx,
  userId: Id<'users'>,
  profile: {
    firstName?: string;
    lastName?: string;
    profileUrl?: string;
  }
) {
  await ctx.db.patch('users', userId, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileUrl: profile.profileUrl
  });

  const updatedUser = await ctx.db.get('users', userId);
  if (!updatedUser) {
    throw new Error('Failed to sync user profile');
  }

  return updatedUser;
}

/**
 * Generate a unique username from a full name.
 * Format: firstname + first letter of lastname + random numbers
 * Example: "John Doe" → "johnd4523"
 */
async function generateUniqueUsername(ctx: MutationCtx, fullName: string): Promise<string> {
  // Parse name parts
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'user';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '';

  // Create base username (lowercase)
  const baseUsername = (firstName + lastInitial).toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Try with 6 random digits (1 million combinations)
  const randomSuffix = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  const candidateUsername = baseUsername + randomSuffix;

  // Check if taken
  const existing = await ctx.db
    .query('users')
    .withIndex('by_username', q => q.eq('username', candidateUsername))
    .unique();

  if (!existing) {
    return candidateUsername;
  }

  // 2. Fallback: Use full timestamp to guarantee uniqueness
  // This only runs in the 0.0001% case of a collision
  return baseUsername + Date.now();
}

/**
 * Get or create a user from Clerk identity.
 * This implements lazy user creation - the first time a Clerk user
 * interacts with the app, we create their Convex user record.
 */
export const getOrCreateUser = zMutation({
  args: {},
  returns: userSchema,
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const clerkProfile = getClerkProfileSnapshot(identity as unknown as Record<string, unknown>);

    // Check if user already exists
    const existingUser = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier, { includeDeleted: true });

    if (existingUser) {
      if (isDeletedUser(existingUser)) {
        throw new Error('Account has been deleted.');
      }

      const shouldSyncProfile =
        existingUser.firstName !== clerkProfile.firstName ||
        existingUser.lastName !== clerkProfile.lastName ||
        existingUser.profileUrl !== clerkProfile.profileUrl;

      if (shouldSyncProfile) {
        return await syncClerkProfileToUser(ctx, existingUser._id, identity as unknown as Record<string, unknown>);
      }

      return existingUser;
    }

    // Generate unique username from Google OAuth name
    const fullName = identity.name || identity.email || 'User';
    const username = await generateUniqueUsername(ctx, fullName);

    // Create new user from Clerk identity
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      username,
      firstName: clerkProfile.firstName,
      lastName: clerkProfile.lastName,
      profileUrl: clerkProfile.profileUrl,
      gender: undefined,
      bio: undefined,
      location: undefined,
      unreadNotificationCount: 0,
      privacySettings: undefined
    });

    const newUser = await ctx.db.get('users', userId);
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return newUser;
  }
});

/**
 * Get the current authenticated user.
 * Returns null if not authenticated or user doesn't exist.
 */
export const getCurrentUser = zQuery({
  args: {},
  returns: userSchema.nullable(),
  handler: async ctx => {
    return await getCurrentAuthenticatedUser(ctx);
  }
});

/**
 * Get a user by their Convex ID.
 */
export const getUser = zQuery({
  args: {
    userId: zid('users')
  },
  returns: userSchema.nullable(),
  handler: async (ctx, args) => {
    return await ctx.db.get('users', args.userId);
  }
});

/**
 * Update the current user's profile.
 */
export const updateUser = zMutation({
  args: userUpdateSchema.shape,
  returns: z.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);

    if (!user) {
      throw new Error('User not found');
    }

    const updates: {
      username?: string;
      gender?: 'Male' | 'Female';
      age?: number;
      dominantHand?: 'Left' | 'Right';
      bio?: string;
      location?: {
        city: string;
        postalCode: string;
        address?: string;
      };
      privacySettings?: {
        hideLastName: boolean;
        hideName: boolean;
      };
    } = {};

    if (args.username !== undefined) {
      updates.username = args.username;
    }
    if (args.gender !== undefined) {
      updates.gender = args.gender;
    }
    if (args.age !== undefined) {
      updates.age = args.age;
    }
    if (args.dominantHand !== undefined) {
      updates.dominantHand = args.dominantHand;
    }
    if (args.bio !== undefined) {
      updates.bio = args.bio;
    }
    if (args.location !== undefined) {
      updates.location = args.location;
    }
    if (args.privacySettings !== undefined) {
      updates.privacySettings = args.privacySettings;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch('users', user._id, updates);
    }

    return null;
  }
});

/**
 * Synchronize Clerk-managed profile fields onto the current user record.
 */
export const syncClerkProfile = zMutation({
  args: clerkProfileSyncSchema.shape,
  returns: userSchema,
  handler: async (ctx, args) => {
    const user = await getCurrentAuthenticatedUser(ctx);

    if (!user) {
      throw new Error('User not found');
    }

    return await patchClerkProfileOnUser(ctx, user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      profileUrl: args.profileUrl
    });
  }
});

export const deleteUserById = zInternalMutation({
  args: {
    userId: zid('users'),
    deletedAt: z.number().int().positive()
  },
  returns: z.object({
    userId: zid('users'),
    deletedAt: z.number().int().positive()
  }),
  handler: async (ctx, args) => {
    return await finalizeUserDeletion(ctx, args.userId, args.deletedAt);
  }
});

/**
 * Internal helper to get userId from Clerk identity.
 * Throws if user doesn't exist.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier, { includeDeleted: true });

  if (!user) {
    throw new Error('User not found. Please sign in first.');
  }

  if (isDeletedUser(user)) {
    throw new Error('Account has been deleted.');
  }

  return user._id;
}

/**
 * Get a user by their username.
 * Used for public profile pages.
 */
export const getUserByUsername = zQuery({
  args: {
    username: z.string()
  },
  returns: userSchema.nullable(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_username', q => q.eq('username', args.username))
      .unique();

    if (!user || isDeletedUser(user)) {
      return null;
    }

    return user;
  }
});
