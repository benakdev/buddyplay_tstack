'use client';

import { Info } from 'lucide-react';

import { SelectField } from '@/components/form';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';
import { getPlaytomicLabel, getWPRLabel } from '@/lib/schema/ui-helpers';

import { SkillSlider } from '../SkillSlider';
import { RatingHelpDialog } from './RatingHelpDialog';
import { type FieldError, getErrorMessage } from './types';
import type { PassportForm } from './usePassportForm';

interface SkillSectionProps {
  form: PassportForm;
  sport: Sport;
  skillRange: { min: number; max: number; step: number };
  clubs: Array<{ _id: Id<'clubs'>; name: string; slug: string }> | undefined;
  wprCap: number;
  isMobile?: boolean;
}

export function SkillSection({ form, sport, skillRange, clubs, wprCap, isMobile = false }: SkillSectionProps) {
  const idSuffix = isMobile ? '-mobile' : '';
  const playtomicMin = skillRange.min;
  const playtomicMax = skillRange.max;
  const wprMin = 0;
  const wprMax = 21;
  const ratingRatio = 3;
  const ratingStep = 0.1;

  const clubOptions = (clubs ?? []).map(club => ({ value: club._id, label: club.name }));

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const roundToStep = (value: number, step: number) => Math.round(value / step) * step;
  const toWpr = (playtomic: number) => roundToStep(clamp(playtomic * ratingRatio, wprMin, wprMax), ratingStep);
  const toPlaytomic = (wpr: number) => roundToStep(clamp(wpr / ratingRatio, playtomicMin, playtomicMax), ratingStep);
  const syncWprFromPlaytomic = (value: number) => {
    const clamped = clamp(value, playtomicMin, playtomicMax);
    const nextWpr = toWpr(clamped);
    if (form.getFieldValue('wprRating') !== nextWpr) {
      form.setFieldValue('wprRating', nextWpr);
    }
    return clamped;
  };
  const syncPlaytomicFromWpr = (value: number) => {
    const clamped = clamp(value, wprMin, wprMax);
    const nextPlaytomic = toPlaytomic(clamped);
    if (form.getFieldValue('playtomicRating') !== nextPlaytomic) {
      form.setFieldValue('playtomicRating', nextPlaytomic);
    }
    return clamped;
  };

  return (
    <div className="space-y-4">
      {/* Home Club */}
      <form.Field name="homeClubId">
        {field => {
          const errorMessage = getErrorMessage(field.state.meta.errors[0] as FieldError | undefined);
          return (
            <SelectField
              label="Home Club"
              id={`homeClubId${idSuffix}`}
              value={String(field.state.value ?? '')}
              onChange={value => field.handleChange(value)}
              onBlur={field.handleBlur}
              placeholder={clubs === undefined ? 'Loading clubs…' : 'Select your home club'}
              options={clubOptions}
              disabled={clubs === undefined}
              error={errorMessage}
              invalid={field.state.meta.errors.length > 0}
            />
          );
        }}
      </form.Field>

      {sport === 'Padel' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Ratings</Label>
            <RatingHelpDialog />
          </div>

          <form.Field name="playtomicRating">
            {field => (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs tracking-wider uppercase">Playtomic Rating</Label>
                <SkillSlider
                  sport="Padel"
                  value={field.state.value ?? skillRange.min}
                  onValueChange={value => {
                    syncWprFromPlaytomic(value);
                  }}
                  onValueCommit={value => {
                    const clamped = syncWprFromPlaytomic(value);
                    field.handleChange(clamped);
                  }}
                  // Uses default SKILL_RANGES for Padel (1-7)
                  // But uses custom detailed label mapper
                  getLabel={getPlaytomicLabel}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="wprRating">
            {field => (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground text-xs tracking-wider uppercase">WPR Rating</Label>
                  {field.state.value !== undefined && field.state.value > wprCap && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex items-center"
                          aria-label="WPR rating info"
                        >
                          <Info className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-xs">
                        WPR ratings above {wprCap.toFixed(1)} are self-reported and not verified by BuddyPlay.
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <SkillSlider
                  sport="Padel"
                  value={field.state.value ?? 0.0}
                  onValueChange={value => {
                    syncPlaytomicFromWpr(value);
                  }}
                  onValueCommit={value => {
                    const clamped = syncPlaytomicFromWpr(value);
                    field.handleChange(clamped);
                  }}
                  // Custom range for WPR
                  min={wprMin}
                  max={wprMax} // As per schema
                  step={ratingStep}
                  getLabel={getWPRLabel}
                />
              </div>
            )}
          </form.Field>
        </div>
      ) : (
        <form.Field name="skillLevel">
          {field => (
            <div className="space-y-4">
              <SkillSlider
                sport={sport}
                value={field.state.value ?? skillRange.min}
                onValueCommit={value => field.handleChange(value)}
              />
            </div>
          )}
        </form.Field>
      )}
    </div>
  );
}
