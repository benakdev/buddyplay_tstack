'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { SKILL_RANGES } from '@/convex/lib/validation/sharedSchemas';
import type { Sport } from '@/lib/schema/types';
import { getSkillLabel } from '@/lib/schema/ui-helpers';
import { cn } from '@/lib/utils';

interface SkillSliderProps {
  sport: Sport;
  value: number;
  onValueChange?: (value: number) => void;
  onValueCommit: (value: number) => void;
  disabled?: boolean;
  className?: string;
  // Overrides
  min?: number;
  max?: number;
  step?: number;
  getLabel?: (value: number) => string;
}

/**
 * SkillSlider - A specialized slider for skill level selection.
 * Features editable numeric input synced with slider.
 */
export function SkillSlider({
  sport,
  value,
  onValueChange,
  onValueCommit,
  disabled = false,
  className,
  min: minProp,
  max: maxProp,
  step: stepProp,
  getLabel
}: SkillSliderProps) {
  const { min: defaultMin, max: defaultMax } = SKILL_RANGES[sport];

  const min = minProp ?? defaultMin;
  const max = maxProp ?? defaultMax;
  // Default step is always 0.1 for fine control
  const step = stepProp ?? 0.1;

  const [localValue, setLocalValue] = React.useState(value);
  const [inputValue, setInputValue] = React.useState(value.toFixed(1));
  const isEditingRef = React.useRef(false);

  // Use custom label function if provided, otherwise default
  const label = getLabel ? getLabel(localValue) : getSkillLabel(sport, localValue);

  // Sync local value with prop when not actively editing
  React.useEffect(() => {
    if (isEditingRef.current) {
      setLocalValue(value);
      return;
    }

    setLocalValue(value);
    setInputValue(value.toFixed(1));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;

    // Strict validation: Don't allow more than 1 decimal place
    if (newVal.includes('.') && newVal.split('.')[1].length > 1) {
      return;
    }

    setInputValue(newVal);

    // Sync slider preview immediately if valid, but don't commit to parent
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      setLocalValue(clamped);
    }
  };

  const handleInputBlur = () => {
    isEditingRef.current = false;
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      // Round to step
      const rounded = Math.round(clamped / step) * step;
      setLocalValue(rounded);
      setInputValue(rounded.toFixed(1));
      onValueCommit(rounded);
    } else {
      // Reset to current value if invalid
      setInputValue(localValue.toFixed(1));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleSliderChange = (val: number | readonly number[]) => {
    const v = Array.isArray(val) ? val[0] : val;
    setLocalValue(v);
    setInputValue(v.toFixed(1));
    onValueChange?.(v);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Value display - OTP-style cell that's clearly editable */}
      <div className="flex items-baseline justify-between">
        <div className="relative inline-flex">
          <Input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              isEditingRef.current = true;
            }}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
            className="border-primary/30 focus:border-primary h-12 w-20 rounded-lg border-2 bg-transparent p-0 text-center text-2xl font-semibold tabular-nums shadow-sm transition-colors focus:ring-2 focus:ring-offset-0"
            aria-label="Rating value"
          />
        </div>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>

      {/* Slider - smaller thumb (size-8 instead of size-11) */}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[localValue]}
        onValueChange={handleSliderChange}
        onValueCommitted={(val: number | readonly number[]) => {
          const v = Array.isArray(val) ? val[0] : val;
          onValueCommit(v);
        }}
        disabled={disabled}
        aria-label={`Skill level for ${sport}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={localValue}
        aria-valuetext={`Level ${localValue}, ${label}`}
        className="py-2 **:data-[slot=slider-thumb]:size-8 **:data-[slot=slider-thumb]:border-2"
      />

      {/* Range labels */}
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{min.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}
