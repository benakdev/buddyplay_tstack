'use client';

import { Calendar, Save, Target } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';

import { AvailabilitySection } from './AvailabilitySection';
import { DeletePassportDialog } from './DeletePassportDialog';
import { PreferencesSection } from './PreferencesSection';
import { SkillSection } from './SkillSection';
import { usePassportForm } from './usePassportForm';

interface DesktopSheetProps {
  sport: Sport;
  mode: 'create' | 'edit';
  profileId?: Id<'userSportProfiles'>;
  initialData?: Parameters<typeof usePassportForm>[0]['initialData'];
  clubs: Array<{ _id: Id<'clubs'>; name: string; slug: string }> | undefined;
  onSuccess: () => void;
}

export function DesktopSheet({ sport, mode, profileId, initialData, clubs, onSuccess }: DesktopSheetProps) {
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

  return (
    <>
      <ResponsiveFormContainer
        open={true}
        onOpenChange={isOpen => !isOpen && onSuccess()}
        sheetContentProps={{ className: 'flex h-full min-w-fit flex-col px-6 sm:max-w-2xl' }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          <div className="grid gap-8 py-6">
            {/* Skill & Identity Section */}
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <Target className="text-primary size-5" />
                Skill
              </h3>
              <SkillSection form={form} sport={sport} skillRange={skillRange} clubs={clubs} wprCap={wprCap} />
              <PreferencesSection form={form} sport={sport} />
            </div>

            {/* Availability Section */}
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <Calendar className="text-primary size-5" />
                Availability
              </h3>
              <AvailabilitySection form={form} />
            </div>
          </div>
        </div>

        <SheetFooter className="flex flex-col gap-2 pt-2 sm:justify-normal">
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={onSuccess} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  await form.handleSubmit();
                  // Check if form is invalid after submit attempt
                  const state = form.store.state;
                  if (
                    Object.keys(state.errors).length > 0 ||
                    Object.values(state.fieldMeta).some(f => f.errors.length > 0)
                  ) {
                    toast.error('Please fix the errors before saving.');
                  }
                } catch (error) {
                  console.error('Submit error:', error);
                }
              }}
              disabled={isSubmitting}
              className="flex-1"
            >
              <Save className="mr-2 size-4" />
              Save
            </Button>
          </div>
          {mode === 'edit' && (
            <Button
              variant="ghost"
              onClick={() => setDeleteAlertOpen(true)}
              disabled={isSubmitting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
            >
              Delete Passport
            </Button>
          )}
        </SheetFooter>
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
