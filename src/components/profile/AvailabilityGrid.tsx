'use client';

import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Availability, TimeSlot } from '@/lib/schema/types';
import { getAvailabilitySummary } from '@/lib/schema/ui-helpers';
import { cn } from '@/lib/utils';

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
] as const;

const TIME_SLOTS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' }
] as const;

interface AvailabilityGridProps {
  value: Availability;
  onValueChange: (availability: Availability) => void;
  className?: string;
}

/**
 * AvailabilityGrid - 7-day tab availability selector.
 *
 * UI Pattern:
 * - 7 day tabs (Mon-Sun) in a toggle group
 * - Selecting a day shows 3 time slot toggles
 * - Only one day visible at a time (cleaner on mobile)
 */
export function AvailabilityGrid({ value, onValueChange, className }: AvailabilityGridProps) {
  const [selectedDay, setSelectedDay] = React.useState<keyof Availability>('monday');

  const currentDaySlots = value[selectedDay] || {};

  const handleSlotToggle = (slot: keyof TimeSlot) => {
    const updatedSlots = {
      ...currentDaySlots,
      [slot]: !currentDaySlots[slot]
    };

    onValueChange({
      ...value,
      [selectedDay]: updatedSlots
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Day selector */}
      <div className="space-y-2">
        <ToggleGroup
          type="single"
          value={selectedDay}
          onValueChange={v => v && setSelectedDay(v as keyof Availability)}
          className="flex flex-wrap justify-start gap-1"
        >
          {DAYS.map(day => {
            const hasSlots = value[day.key] && Object.values(value[day.key]!).some(Boolean);
            return (
              <ToggleGroupItem
                key={day.key}
                value={day.key}
                aria-label={day.label}
                className={cn('min-w-11 px-2', hasSlots && 'ring-primary/50 ring-2')}
              >
                {day.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Time slots for selected day */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.key}
              type="button"
              onClick={() => handleSlotToggle(slot.key)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:ring-ring border focus-visible:ring-2 focus-visible:outline-none',
                currentDaySlots[slot.key]
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <p className="text-muted-foreground text-sm">{getAvailabilitySummary(value)}</p>
    </div>
  );
}
