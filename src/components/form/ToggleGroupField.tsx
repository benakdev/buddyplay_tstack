'use client';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface ToggleOption {
  value: string;
  label: React.ReactNode;
  className?: string;
}

interface ToggleGroupFieldProps {
  label: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ToggleOption[];
  error?: string;
  invalid?: boolean;
  description?: string;
  className?: string;
  itemClassName?: string;
}

export function ToggleGroupField({
  label,
  id,
  value,
  onChange,
  onBlur,
  options,
  error,
  invalid,
  description,
  className,
  itemClassName
}: ToggleGroupFieldProps) {
  return (
    <Field data-invalid={invalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={v => v && onChange(v)}
        onBlur={onBlur}
        className={cn('justify-start', itemClassName)}
        aria-invalid={invalid}
        id={id}
      >
        {options.map(option => (
          <ToggleGroupItem key={option.value} value={option.value} className={option.className}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
