'use client';

import * as React from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

interface FormFieldProps extends Omit<React.ComponentProps<typeof Field>, 'className'> {
  label?: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  invalid?: boolean;
  className?: string;
}

/**
 * FormField - Base wrapper connecting TanStack Form with shadcn Field component.
 *
 * Features:
 * - Automatic data-invalid attribute on Field wrapper for styling
 * - Optional FieldError display (only when error prop provided)
 * - Supports FieldDescription for helper text
 * - Accessible by default
 */
export function FormField({
  label,
  htmlFor,
  description,
  error,
  children,
  invalid = false,
  className,
  ...props
}: FormFieldProps) {
  return (
    <Field data-invalid={invalid || undefined} className={cn('gap-2', className)} {...props}>
      {label && <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>}
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
