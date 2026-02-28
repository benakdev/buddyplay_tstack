import type { Id } from '@/convex/_generated/dataModel';
import type { PassportFormValues } from '@/lib/schema/passportForm';
import type { Sport } from '@/lib/schema/types';

export type PassportFormData = PassportFormValues;

export interface PassportEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: Sport;
  mode: 'create' | 'edit';
  profileId?: Id<'userSportProfiles'>;
  initialData?: Partial<PassportFormData>;
}

// Mobile wizard steps
export const WIZARD_STEPS = ['level', 'preferences', 'availability'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type FieldError = { message?: string } | string;

export function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

// Generate a unique key for the form based on initial data
// This forces React to remount the form when the data changes
export function getFormKey(initialData: Partial<PassportFormData> | undefined, sport: Sport): string {
  return `${sport}-${initialData?.skillLevel ?? 'new'}-${initialData?.playtomicRating ?? 'p'}-${initialData?.wprRating ?? 'w'}-${initialData?.homeClubId ?? 'club'}-${initialData?.hand ?? 'new'}-${initialData?.courtSide ?? 'none'}-${initialData?.preferredGender ?? 'any'}`;
}
