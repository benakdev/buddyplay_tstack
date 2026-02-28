'use client';

import { AvailabilityGrid } from '../AvailabilityGrid';
import type { PassportForm } from './usePassportForm';

interface AvailabilitySectionProps {
  form: PassportForm;
}

export function AvailabilitySection({ form }: AvailabilitySectionProps) {
  return (
    <form.Field name="availability">
      {field => (
        <div className="space-y-2">
          <AvailabilityGrid value={field.state.value ?? {}} onValueChange={value => field.handleChange(value)} />
        </div>
      )}
    </form.Field>
  );
}
