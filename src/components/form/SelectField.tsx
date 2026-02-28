'use client';

import * as React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { FormField } from './FormField';

interface SelectOption {
  value: string;
  label: React.ReactNode;
}

interface SelectFieldProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
  invalid?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * SelectField - Select dropdown with integrated validation support.
 *
 * Features:
 * - Wrapped in FormField for consistent label/description/error display
 * - Automatic aria-invalid binding
 * - Supports option list configuration
 */
export function SelectField({
  label,
  description,
  error,
  invalid = false,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  id,
  className,
  disabled
}: SelectFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      description={description}
      error={error}
      invalid={invalid}
      className={className}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={invalid} onBlur={onBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
