'use client';

import * as React from 'react';

import { Textarea } from '@/components/ui/textarea';

import { FormField } from './FormField';

interface TextareaFieldProps extends Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
  invalid?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * TextareaField - Textarea input with integrated validation support.
 *
 * Features:
 * - Wrapped in FormField for consistent label/description/error display
 * - Automatic aria-invalid binding
 * - Supports all Textarea props except value/onChange/onBlur (which are handled specially)
 */
export function TextareaField({
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
}: TextareaFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      description={description}
      error={error}
      invalid={invalid}
      className={className}
    >
      <Textarea
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
