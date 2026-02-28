import { z } from 'zod';

import type { Doc } from '@/convex/_generated/dataModel';
import {
  availabilitySchema,
  courtSideSchema,
  genderSchema,
  handSchema,
  preferredGenderSchema,
  sportTypeSchema,
  timeSlotSchema
} from '@/convex/lib/validation/sharedSchemas';

/**
 * Profile Type Exports
 *
 * Types derived from canonical Convex schemas.
 */

export type Sport = z.infer<typeof sportTypeSchema>;
export type Hand = z.infer<typeof handSchema>;
export type CourtSide = z.infer<typeof courtSideSchema>;
export type PreferredGender = z.infer<typeof preferredGenderSchema>;
export type Gender = z.infer<typeof genderSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type Availability = z.infer<typeof availabilitySchema>;

/**
 * ProfileData type derived from Convex user schema.
 * Combines Convex user fields with Clerk-derived fields for public profile display.
 */
export type ProfileData = Pick<Doc<'users'>, 'username' | 'bio' | 'location'> & {
  /** Derived from Clerk firstName + lastName */
  name: string;
  /** From Clerk user profile */
  imageUrl: string;
  /** User account creation timestamp (from Convex _creationTime) */
  joinedAt: number;
};
