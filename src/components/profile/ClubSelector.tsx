'use client';

import * as React from 'react';

import { MapPin } from 'lucide-react';

import { ClubChip } from '@/components/ui/club-chip';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface Club {
  id: string;
  name: string;
  city: string;
}

interface ClubSelectorProps {
  clubs: Club[];
  selectedClubIds: string[];
  onSelectionChange: (clubIds: string[]) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * ClubSelector - Autocomplete for selecting clubs.
 *
 * Features:
 * - Searchable combobox filtering clubs by name
 * - Selected clubs displayed as removable chips
 * - "No clubs selected = any club in my city" behavior shown in helper text
 */
export function ClubSelector({
  clubs,
  selectedClubIds,
  onSelectionChange,
  isLoading = false,
  className
}: ClubSelectorProps) {
  const [inputValue, setInputValue] = React.useState('');

  const selectedClubs = clubs.filter(c => selectedClubIds.includes(c.id));
  const filteredClubs = clubs.filter(
    c => c.name.toLowerCase().includes(inputValue.toLowerCase()) && !selectedClubIds.includes(c.id)
  );

  const handleSelect = (club: Club | null) => {
    if (club) {
      onSelectionChange([...selectedClubIds, club.id]);
      setInputValue('');
    }
  };

  const handleRemove = (clubId: string) => {
    onSelectionChange(selectedClubIds.filter(id => id !== clubId));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label>My Clubs</Label>

      {/* Selected clubs as chips */}
      {selectedClubs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedClubs.map(club => (
            <ClubChip key={club.id} name={club.name} city={club.city} onRemove={() => handleRemove(club.id)} />
          ))}
        </div>
      )}

      {/* Combobox */}
      <Combobox value={null} onValueChange={handleSelect} disabled={isLoading}>
        <ComboboxInput
          placeholder="Search clubs…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          showTrigger
        />
        <ComboboxContent className="w-(--radix-popover-trigger-width)">
          <ComboboxList>
            <ComboboxEmpty>No clubs found.</ComboboxEmpty>
            {filteredClubs.map(club => (
              <ComboboxItem key={club.id} value={club}>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{club.name}</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="size-3" />
                      {club.city}
                    </span>
                  </div>
                </div>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Helper text */}
      <p className="text-muted-foreground text-xs">
        {selectedClubs.length === 0
          ? "No clubs selected — you'll see games at any club in your city."
          : `Showing games from ${selectedClubs.length} club${selectedClubs.length > 1 ? 's' : ''}.`}
      </p>
    </div>
  );
}
