import { z } from 'zod';

// ============================================
// ENUMS - Single Source of Truth
// ============================================

export const sportTypeSchema = z.enum(['Padel', 'Pickleball']);
export const activityStatusSchema = z.enum(['OPEN', 'FILLED', 'COMPLETED', 'CANCELLED']);
export const requestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export const conversationTypeSchema = z.enum(['DM', 'ACTIVITY', 'GROUP']);
export const participantStatusSchema = z.enum(['JOINED', 'INVITED', 'LEFT', 'REMOVED']);
export const handSchema = z.enum(['Left', 'Right']);
export const courtSideSchema = z.enum(['Left', 'Right', 'Both']);
export const preferredGenderSchema = z.enum(['Any', 'Male', 'Female']);
export const genderSchema = z.enum(['Male', 'Female']);
export const joinedViaSchema = z.enum(['REQUEST', 'INVITE', 'BROADCAST', 'CREATOR']);
export const notificationTypeSchema = z.enum([
  'MESSAGE',
  'REQUEST',
  'APPROVED',
  'REJECTED',
  'ACTIVITY_ALERT',
  'PLAYER_MATCH'
]);
export const notificationMatchStatusSchema = z.enum(['ACTIVE', 'INVALID', 'REMOVED']);

export const usernameSchema = z
  .string()
  .min(3, { message: 'Username must be at least 3 characters' })
  .max(30, { message: 'Username must be at most 30 characters' })
  .regex(/^[a-zA-Z0-9]+$/, { message: 'Username can only contain letters and numbers' })
  .refine(val => !/^\d+$/.test(val), { message: 'Username cannot be just numbers' });

// ============================================
// SKILL RANGES - Validated Constant
// ============================================

const skillRangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().positive(),
  step: z.number().positive().multipleOf(0.5)
});

const skillRangesSchema = z.record(sportTypeSchema, skillRangeSchema);

export const SKILL_RANGES = skillRangesSchema.parse({
  Padel: { min: 0.0, max: 7.0, step: 0.5 },
  Pickleball: { min: 1.0, max: 5.5, step: 0.5 }
});

// ============================================
// AVAILABILITY SCHEMAS
// ============================================

export const timeSlotSchema = z.object({
  morning: z.boolean().optional(),
  afternoon: z.boolean().optional(),
  evening: z.boolean().optional()
});

export const availabilitySchema = z.object({
  monday: timeSlotSchema.optional(),
  tuesday: timeSlotSchema.optional(),
  wednesday: timeSlotSchema.optional(),
  thursday: timeSlotSchema.optional(),
  friday: timeSlotSchema.optional(),
  saturday: timeSlotSchema.optional(),
  sunday: timeSlotSchema.optional()
});
