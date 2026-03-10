import { z } from 'zod';

import {
  activityStatusSchema,
  availabilitySchema,
  conversationTypeSchema,
  courtSideSchema,
  genderSchema,
  handSchema,
  joinedViaSchema,
  notificationMatchStatusSchema,
  notificationTypeSchema,
  participantStatusSchema,
  preferredGenderSchema,
  requestStatusSchema,
  sportTypeSchema,
  usernameSchema
} from './validation/sharedSchemas';
import { zid } from './zodHelpers';

export const paginationOptsSchema = z.object({
  numItems: z.number().int().positive(),
  cursor: z.string().nullable()
});

export const locationSchema = z.object({
  city: z.string().min(1),
  postalCode: z.string().min(1),
  address: z.string().min(1).optional()
});

export const activityLocationSchema = z.object({
  city: z.string().min(1),
  clubId: zid('clubs').optional(),
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional()
});

export const activityRequirementsSchema = z.object({
  levelMin: z.number().positive(),
  levelMax: z.number().positive(),
  gender: preferredGenderSchema.optional(),
  slotsTotal: z.number().int().positive()
});

export const requirementsUpdateSchema = activityRequirementsSchema.partial();

export const privacySettingsSchema = z.object({
  hideLastName: z.boolean(),
  hideName: z.boolean()
});

export const userTableSchema = z.object({
  tokenIdentifier: z.string(),
  username: usernameSchema,
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  profileUrl: z.url().optional(),
  deletedAt: z.number().int().positive().optional(),
  gender: genderSchema.optional(),
  age: z.number().int().min(13).max(120).optional(),
  dominantHand: handSchema.optional(),
  bio: z.string().min(1).optional(),
  location: locationSchema.optional(),
  unreadNotificationCount: z.number().int().nonnegative().optional(),
  privacySettings: privacySettingsSchema.optional()
});

export const userSchema = userTableSchema.extend({
  _id: zid('users'),
  _creationTime: z.number().positive()
});

export const userUpdateSchema = userTableSchema
  .pick({
    username: true,
    gender: true,
    age: true,
    dominantHand: true,
    bio: true,
    location: true,
    privacySettings: true
  })
  .partial();

export const clerkProfileSyncSchema = userTableSchema
  .pick({
    firstName: true,
    lastName: true,
    profileUrl: true
  })
  .partial();

export const clubTableSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().min(1).optional(),
  website: z.url().optional(),
  sportsSupported: z.array(sportTypeSchema).min(1)
});

export const clubSchema = clubTableSchema.extend({
  _id: zid('clubs'),
  _creationTime: z.number().positive()
});

export const sportProfileTableSchema = z.object({
  userId: zid('users'),
  sport: sportTypeSchema,
  isActive: z.boolean(),
  skillLevel: z.number().min(0).optional(),
  homeClubId: zid('clubs').optional(),
  playtomicRating: z.number().min(0).max(7).optional(),
  wprRating: z.number().min(0).max(21).optional(),
  matchingTolerance: z.number().positive().optional(),
  attributes: z
    .object({
      hand: handSchema.optional(),
      courtSide: courtSideSchema.optional()
    })
    .optional(),
  preferredGender: preferredGenderSchema.optional(),
  availability: availabilitySchema.optional(),
  updatedAt: z.number().int().positive().optional()
});

export const sportProfileUpsertSchema = sportProfileTableSchema.omit({
  userId: true,
  updatedAt: true
});

export const sportProfileUpdateSchema = sportProfileUpsertSchema.partial();

export const sportProfileUpdateArgsSchema = sportProfileUpdateSchema.extend({
  profileId: zid('userSportProfiles')
});

export const sportProfileSchema = sportProfileTableSchema.extend({
  _id: zid('userSportProfiles'),
  _creationTime: z.number().positive()
});

export const activityTableSchema = z.object({
  creatorId: zid('users'),
  sport: sportTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  status: activityStatusSchema,
  location: activityLocationSchema,
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive().optional(),
  requirements: activityRequirementsSchema,
  joinedCount: z.number().int().nonnegative(),
  broadcastSentAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional()
});

export const activitySchema = activityTableSchema.extend({
  _id: zid('activities'),
  _creationTime: z.number().positive()
});

export const activityParticipantTableSchema = z.object({
  activityId: zid('activities'),
  userId: zid('users'),
  status: participantStatusSchema,
  joinedVia: joinedViaSchema.optional()
});

export const activityParticipantSchema = activityParticipantTableSchema.extend({
  _id: zid('activityParticipants'),
  _creationTime: z.number().positive()
});

export const alertFiltersSchema = z.object({
  city: z.string().min(1),
  levelMin: z.number().positive().optional(),
  levelMax: z.number().positive().optional(),
  clubId: zid('clubs').optional()
});

export const alertTableSchema = z.object({
  userId: zid('users'),
  profileId: zid('userSportProfiles').optional(),
  sport: sportTypeSchema,
  active: z.boolean(),
  isPassport: z.boolean().optional(),
  filters: alertFiltersSchema,
  lastAlertSentAt: z.number().int().positive().optional(),
  alertCountToday: z.number().int().nonnegative().optional()
});

export const alertSchema = alertTableSchema.extend({
  _id: zid('alerts'),
  _creationTime: z.number().positive()
});

export const requestTableSchema = z.object({
  activityId: zid('activities'),
  userId: zid('users'),
  hostId: zid('users'),
  status: requestStatusSchema,
  message: z.string().min(1).optional(),
  respondedAt: z.number().int().positive().optional()
});

export const requestSchema = requestTableSchema.extend({
  _id: zid('requests'),
  _creationTime: z.number().positive()
});

export const notificationTableSchema = z.object({
  userId: zid('users'),
  type: notificationTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  read: z.boolean(),
  profileId: zid('userSportProfiles').optional(),
  matchingProfileId: zid('userSportProfiles').optional(),
  matchStatus: notificationMatchStatusSchema.optional(),
  data: z.any().optional()
});

export const notificationSchema = notificationTableSchema.extend({
  _id: zid('notifications'),
  _creationTime: z.number().positive()
});

export const conversationTableSchema = z.object({
  activityId: zid('activities').optional(),
  type: conversationTypeSchema,
  name: z.string().min(1).optional(),
  lastMessageAt: z.number().int().positive().optional(),
  lastMessagePreview: z.string().min(1).optional()
});

export const conversationSchema = conversationTableSchema.extend({
  _id: zid('conversations'),
  _creationTime: z.number().positive()
});

export const conversationParticipantTableSchema = z.object({
  conversationId: zid('conversations'),
  userId: zid('users'),
  hiddenAt: z.number().int().positive().optional()
});

export const conversationParticipantSchema = conversationParticipantTableSchema.extend({
  _id: zid('conversationParticipants'),
  _creationTime: z.number().positive()
});

export const messageTableSchema = z.object({
  conversationId: zid('conversations'),
  senderId: zid('users'),
  content: z.string().min(1)
});

export const messageSchema = messageTableSchema.extend({
  _id: zid('messages'),
  _creationTime: z.number().positive()
});

// Result schemas for enriched queries
export const creatorSchema = z.object({
  _id: zid('users'),
  username: z.string().min(1),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  profileUrl: z.url().optional()
});

export const activityWithCreatorSchema = z.object({
  activity: activitySchema,
  creator: creatorSchema
});
