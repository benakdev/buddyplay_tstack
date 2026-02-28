'use client';

import * as React from 'react';

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PassportFormValues } from '@/lib/schema/passportForm';
import type { Sport } from '@/lib/schema/types';

import { DesktopSheet, MobileWizard, type WizardStep, getFormKey } from './passport-form';

interface PassportEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: Sport;
  mode: 'create' | 'edit';
  profileId?: Id<'userSportProfiles'>;
  initialData?: Partial<PassportFormValues>;
}

/**
 * PassportEditModal - Full passport editor.
 * Desktop: Two-column Sheet with all fields.
 * Mobile: Multi-step wizard Drawer.
 *
 * Uses a key prop to force remount when initialData changes,
 * eliminating the need for useEffect with form.reset()
 */
export function PassportEditModal({ open, onOpenChange, sport, mode, profileId, initialData }: PassportEditModalProps) {
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('level');
  const isMobile = useIsMobile();
  const clubs = useQuery(api.clubs.listClubs, { sport });

  const defaultHomeClubId = React.useMemo(() => {
    if (!clubs) return undefined;
    return clubs.find(club => club.slug === 'blue-cat-padel')?._id;
  }, [clubs]);

  const initialDataWithDefaults = React.useMemo(() => {
    if (!initialData?.homeClubId && defaultHomeClubId) {
      return { ...initialData, homeClubId: defaultHomeClubId };
    }
    return initialData;
  }, [defaultHomeClubId, initialData]);

  // Reset step when modal opens
  React.useEffect(() => {
    if (open) {
      setCurrentStep('level');
    }
  }, [open]);

  if (!open) return null;

  const formKey = getFormKey(initialDataWithDefaults, sport);
  const sharedProps = {
    sport,
    mode,
    profileId,
    initialData: initialDataWithDefaults,
    clubs,
    onSuccess: () => onOpenChange(false)
  };

  if (isMobile) {
    return <MobileWizard key={formKey} {...sharedProps} currentStep={currentStep} setCurrentStep={setCurrentStep} />;
  }

  return <DesktopSheet key={formKey} {...sharedProps} />;
}
