'use client';

import * as React from 'react';

import { Switch } from '@/components/ui/switch';

import { FormField } from './FormField';

interface SwitchFieldProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
  invalid?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * SwitchField - Switch toggle with integrated validation support.
 *
 * Features:
 * - Wrapped in FormField for consistent label/description/error display
 * - Automatic aria-invalid binding
 * - Horizontal layout by default (label beside switch)
 */
export function SwitchField({
  label,
  description,
  error,
  invalid = false,
  checked,
  onChange,
  id,
  className,
  disabled
}: SwitchFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      description={description}
      error={error}
      invalid={invalid}
      className={className}
      orientation="horizontal"
    >
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} aria-invalid={invalid} />
    </FormField>
  );
}
