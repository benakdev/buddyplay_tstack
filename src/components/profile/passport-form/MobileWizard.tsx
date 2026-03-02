'use client';

import * as React from 'react';

import { ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

import { AvailabilitySection } from './AvailabilitySection';
import { DeletePassportDialog } from './DeletePassportDialog';
import { PreferencesSection } from './PreferencesSection';
import { SkillSection } from './SkillSection';
import { WIZARD_STEPS, type WizardStep } from './types';
import { usePassportForm } from './usePassportForm';

interface MobileWizardProps {
  sport: Sport;
  mode: 'create' | 'edit';
  profileId?: Id<'userSportProfiles'>;
  initialData?: Parameters<typeof usePassportForm>[0]['initialData'];
  clubs: Array<{ _id: Id<'clubs'>; name: string; slug: string }> | undefined;
  onSuccess: () => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
}

export function MobileWizard({
  sport,
  mode,
  profileId,
  initialData,
  clubs,
  onSuccess,
  currentStep,
  setCurrentStep
}: MobileWizardProps) {
  const { form, isSubmitting, deleteAlertOpen, setDeleteAlertOpen, handleDelete, skillRange, wprCap } = usePassportForm(
    {
      sport,
      mode,
      profileId,
      initialData,
      onSuccess
    }
  );

  const title = mode === 'create' ? `Create ${sport} Passport` : `Edit ${sport} Passport`;
  const description =
    mode === 'create'
      ? 'Build your player profile to find the perfect matches.'
      : 'Keep your skills and schedule up to date.';

  // Wizard navigation
  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Step fields mapping
  const currentStepFields = React.useMemo(() => {
    switch (currentStep) {
      case 'level':
        return ['skillLevel', 'homeClubId', 'playtomicRating', 'wprRating'] as const;
      case 'preferences':
        return ['hand', 'courtSide', 'preferredGender'] as const;
      case 'availability':
        return ['availability'] as const;
    }
  }, [currentStep]);

  const goNext = async () => {
    // Validate current step fields
    let hasErrors = false;
    for (const field of currentStepFields) {
      await form.validateField(field, 'change');
      const meta = form.getFieldMeta(field);
      if (meta && meta.errors.length > 0) hasErrors = true;
    }

    if (hasErrors) {
      toast.error('Please fix the errors before proceeding.');
      return;
    }

    if (!isLastStep) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex + 1]);
    } else {
      void form.handleSubmit();
    }
  };

  const goBack = () => {
    if (!isFirstStep) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex - 1]);
    }
  };

  // Step indicator
  const stepIndicator = (
    <div className="flex items-center justify-center gap-1 py-2">
      {WIZARD_STEPS.map((step, i) => (
        <div
          key={step}
          className={cn(
            'h-1 rounded-full transition-all',
            i === currentStepIndex ? 'bg-primary w-8' : i < currentStepIndex ? 'bg-primary/50 w-4' : 'bg-muted w-4'
          )}
        />
      ))}
    </div>
  );

  // Step content
  const stepContent = () => {
    switch (currentStep) {
      case 'level':
        return (
          <div className="space-y-6 px-4 pb-4">
            <h3 className="text-lg font-semibold">Your level</h3>
            <SkillSection form={form} sport={sport} skillRange={skillRange} clubs={clubs} wprCap={wprCap} isMobile />
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6 px-4 pb-4">
            <h3 className="text-lg font-semibold">Play Style</h3>
            <PreferencesSection form={form} sport={sport} isMobile />
          </div>
        );

      case 'availability':
        return (
          <div className="space-y-4 px-4 pb-4">
            <h3 className="text-lg font-semibold">When are you free?</h3>
            <AvailabilitySection form={form} />
          </div>
        );
    }
  };

  return (
    <>
      <ResponsiveFormContainer
        open={true}
        onOpenChange={isOpen => !isOpen && onSuccess()}
        drawerContentProps={{ className: 'max-h-[90vh]' }}
      >
        <DrawerHeader className="pb-0 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
          {stepIndicator}
        </DrawerHeader>

        <div className="overflow-y-auto">{stepContent()}</div>

        <DrawerFooter className="flex-col gap-2">
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={goBack} disabled={isFirstStep} className="flex-1">
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
            <Button onClick={goNext} disabled={isSubmitting} className="flex-1">
              {isLastStep ? (
                <>
                  <Save className="mr-1 size-4" />
                  Save
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </>
              )}
            </Button>
          </div>
          {mode === 'edit' && (
            <Button
              variant="ghost"
              onClick={() => setDeleteAlertOpen(true)}
              disabled={isSubmitting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
            >
              <Trash2 className="mr-1 size-4" />
              Delete Passport
            </Button>
          )}
        </DrawerFooter>
      </ResponsiveFormContainer>

      <DeletePassportDialog
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        sport={sport}
        onConfirm={handleDelete}
      />
    </>
  );
}
