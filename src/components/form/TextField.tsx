'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';

import { FormField } from './FormField';

interface TextFieldProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
  invalid?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * TextField - Text input with integrated validation support.
 *
 * Features:
 * - Wrapped in FormField for consistent label/description/error display
 * - Automatic aria-invalid binding
 * - Supports all Input props except value/onChange/onBlur (which are handled specially)
 */
export function TextField({
  label,
  description,
  error,
  invalid = false,
  value,
  onChange,
  onBlur,
  id,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      description={description}
      error={error}
      invalid={invalid}
      className={className}
    >
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        {...props}
      />
    </FormField>
  );
}
