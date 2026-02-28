'use client';

import { ToggleGroupField } from '@/components/form';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CourtSide, Hand, PreferredGender, Sport } from '@/lib/schema/types';

import { type FieldError, getErrorMessage } from './types';
import type { PassportForm } from './usePassportForm';

interface PreferencesSectionProps {
  form: PassportForm;
  sport: Sport;
  isMobile?: boolean;
}

export function PreferencesSection({ form, sport, isMobile = false }: PreferencesSectionProps) {
  return (
    <div className="space-y-4">
      {/* Dominant Hand */}
      <form.Field name="hand">
        {field => (
          <div className="space-y-2">
            <Label>Dominant Hand</Label>
            <ToggleGroup
              type="single"
              value={field.state.value}
              onValueChange={v => v && field.handleChange(v as Hand)}
              className={isMobile ? 'grid w-full grid-cols-2' : 'justify-start'}
            >
              <ToggleGroupItem value="Left" className={isMobile ? '' : 'px-6'}>
                {isMobile ? 'Left' : 'Left Handed'}
              </ToggleGroupItem>
              <ToggleGroupItem value="Right" className={isMobile ? '' : 'px-6'}>
                {isMobile ? 'Right' : 'Right Handed'}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </form.Field>

      {/* Court Side (Padel only) */}
      {sport === 'Padel' && (
        <form.Field name="courtSide">
          {field => (
            <div className="space-y-2">
              <Label>{isMobile ? 'Court Position' : 'Preferred Court Position'}</Label>
              <ToggleGroup
                type="single"
                value={field.state.value}
                onValueChange={v => v && field.handleChange(v as CourtSide)}
                className={isMobile ? 'grid w-full grid-cols-3' : 'flex-wrap justify-start'}
              >
                <ToggleGroupItem value="Left" className={isMobile ? '' : 'gap-1'}>
                  {!isMobile && <span>←</span>} Left
                </ToggleGroupItem>
                <ToggleGroupItem value="Both" className={isMobile ? '' : 'gap-1'}>
                  {!isMobile && <span>⇄</span>} Both
                </ToggleGroupItem>
                <ToggleGroupItem value="Right" className={isMobile ? '' : 'gap-1'}>
                  {!isMobile && <span>→</span>} Right
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </form.Field>
      )}

      {/* Preferred Opponents */}
      <form.Field name="preferredGender">
        {field => {
          const errorMessage = getErrorMessage(field.state.meta.errors[0] as FieldError | undefined);
          return (
            <ToggleGroupField
              label="Preferred Opponents"
              id="preferredGender"
              value={field.state.value}
              onChange={value => field.handleChange(value as PreferredGender)}
              onBlur={field.handleBlur}
              options={[
                { value: 'Male', label: 'Men' },
                { value: 'Female', label: 'Women' },
                { value: 'Any', label: 'Anyone' }
              ]}
              itemClassName={isMobile ? 'grid w-full grid-cols-3' : undefined}
              error={errorMessage}
              invalid={field.state.meta.errors.length > 0}
            />
          );
        }}
      </form.Field>
    </div>
  );
}
