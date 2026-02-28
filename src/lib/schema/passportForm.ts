import { z } from 'zod';

import {
  SKILL_RANGES,
  availabilitySchema,
  courtSideSchema,
  handSchema,
  preferredGenderSchema
} from '@/convex/lib/validation/sharedSchemas';
import type { Sport } from '@/lib/schema/types';

const basePassportFormSchema = z.object({
  skillLevel: z.number().min(0).optional(),
  homeClubId: z.string(),
  playtomicRating: z.number().min(0).max(7).optional(),
  wprRating: z.number().min(0).max(21).optional(),
  hand: handSchema,
  courtSide: courtSideSchema.optional(),
  preferredGender: preferredGenderSchema,
  availability: availabilitySchema.optional()
});

export function createPassportFormSchema(sport: Sport) {
  const skillRange = SKILL_RANGES[sport];

  return basePassportFormSchema
    .extend({
      skillLevel: z.number().min(skillRange.min).max(skillRange.max).optional(),
      homeClubId: z.string().min(1, { message: 'Home club is required.' }),
      courtSide: sport === 'Padel' ? courtSideSchema : courtSideSchema.optional()
    })
    .superRefine((data, ctx) => {
      if (sport === 'Pickleball' && data.skillLevel === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Skill level is required.', path: ['skillLevel'] });
      }

      if (sport === 'Padel' && data.playtomicRating === undefined && data.wprRating === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Add at least one rating (Playtomic or WPR).',
          path: ['playtomicRating']
        });
      }
    });
}

export type PassportFormValues = z.infer<ReturnType<typeof createPassportFormSchema>>;
