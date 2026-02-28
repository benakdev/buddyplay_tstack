'use client';

import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ClubChipProps {
  name: string;
  city?: string;
  onRemove?: () => void;
  className?: string;
}

/**
 * ClubChip - A removable badge for selected clubs.
 *
 * Shows club name (and optionally city) with an X button to remove.
 * Used in ClubSelector for displaying selected clubs.
 */
export function ClubChip({ name, city, onRemove, className }: ClubChipProps) {
  return (
    <Badge variant="secondary" className={cn('inline-flex items-center gap-1 py-1 pr-1 pl-2.5 text-sm', className)}>
      <span className="max-w-[10rem] truncate">
        {name}
        {city && <span className="text-muted-foreground ml-1">• {city}</span>}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:bg-muted-foreground/20 focus-visible:ring-ring ml-1 rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Remove ${name}`}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </Badge>
  );
}
