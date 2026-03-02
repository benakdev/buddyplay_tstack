'use client';

import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Sport } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

import { PassportEditModal } from './PassportEditModal';

interface AddPassportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSports: Sport[];
}

const sportDescriptions: Record<Sport, string> = {
  Padel: 'Racquet sport played in doubles on an enclosed court',
  Pickleball: 'Paddle sport combining tennis, badminton, and ping-pong'
};

/**
 * AddPassportModal - Sport selection when adding a new passport.
 * Opens PassportEditModal in create mode after selection.
 */
export function AddPassportModal({ open, onOpenChange, availableSports }: AddPassportModalProps) {
  const [selectedSport, setSelectedSport] = React.useState<Sport | null>(null);
  const [editModalOpen, setEditModalOpen] = React.useState(false);

  // Handle sport selection
  const handleSelectSport = (sport: Sport) => {
    setSelectedSport(sport);
    onOpenChange(false);
    // Small delay to let the first modal close smoothly
    setTimeout(() => {
      setEditModalOpen(true);
    }, 150);
  };

  // When edit modal closes
  const handleEditModalClose = (isOpen: boolean) => {
    setEditModalOpen(isOpen);
    if (!isOpen) {
      setSelectedSport(null);
    }
  };

  const content = (
    <div className="grid gap-4 p-4">
      {availableSports.map(sport => (
        <Card
          key={sport}
          className={cn('hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-all', 'group')}
          onClick={() => handleSelectSport(sport)}
        >
          <CardContent className="flex flex-col items-center gap-4 p-6">
            {/* Sport icon removed */}
            <div className="text-center">
              <h3 className="text-lg font-semibold">{sport}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{sportDescriptions[sport]}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <ResponsiveFormContainer open={open} onOpenChange={onOpenChange} sheetContentProps={{ className: 'sm:max-w-md' }}>
        <DrawerHeader className="text-left md:hidden">
          <DrawerTitle>Add Sport Passport</DrawerTitle>
          <DrawerDescription>Choose a sport to create your player profile.</DrawerDescription>
        </DrawerHeader>
        <div className="hidden md:block">
          <SheetHeader>
            <SheetTitle>Add Sport Passport</SheetTitle>
            <SheetDescription>Choose a sport to create your player profile.</SheetDescription>
          </SheetHeader>
        </div>
        {content}
      </ResponsiveFormContainer>
      {selectedSport && (
        <PassportEditModal
          open={editModalOpen}
          onOpenChange={handleEditModalClose}
          sport={selectedSport}
          mode="create"
        />
      )}
    </>
  );
}
