'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Textarea } from '@/components/ui/textarea';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Id } from '@/convex/_generated/dataModel';
import { SKILL_RANGES } from '@/convex/lib/validation/sharedSchemas';
import type { Sport } from '@/lib/schema/types';

import { SPORT_OPTIONS } from './types';

interface CreateGameSheetProps {
  defaultSport?: Sport;
  defaultClubId?: Id<'clubs'>;
}

function getDefaultStartAt(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60, 0, 0);
  const offsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function CreateGameSheet({ defaultSport, defaultClubId }: CreateGameSheetProps) {
  const createActivity = useMutation(api.activities.createActivity);

  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sport, setSport] = React.useState<Sport>(defaultSport ?? 'Padel');
  const [clubId, setClubId] = React.useState<string>(defaultClubId ?? '');
  const [startAt, setStartAt] = React.useState(getDefaultStartAt);
  const [levelMin, setLevelMin] = React.useState(SKILL_RANGES[sport].min);
  const [levelMax, setLevelMax] = React.useState(Math.min(SKILL_RANGES[sport].max, SKILL_RANGES[sport].min + 1));
  const [playersNeeded, setPlayersNeeded] = React.useState(3);
  const [note, setNote] = React.useState('');

  const clubs = useQuery(api.clubs.listClubs, { sport });

  React.useEffect(() => {
    if (defaultSport) {
      setSport(defaultSport);
    }
  }, [defaultSport]);

  React.useEffect(() => {
    const range = SKILL_RANGES[sport];
    setLevelMin(range.min);
    setLevelMax(Math.min(range.max, range.min + 1));
  }, [sport]);

  React.useEffect(() => {
    if (defaultClubId) {
      setClubId(defaultClubId);
    }
  }, [defaultClubId]);

  React.useEffect(() => {
    if (!clubs || clubs.length === 0) {
      return;
    }

    const hasSelectedClub = clubs.some(club => club._id === clubId);
    if (!hasSelectedClub) {
      const fallback = defaultClubId && clubs.some(club => club._id === defaultClubId) ? defaultClubId : clubs[0]._id;
      setClubId(fallback);
    }
  }, [clubId, clubs, defaultClubId]);

  const selectedClub = clubs?.find(club => club._id === clubId);

  const resetForm = () => {
    const nextSport = defaultSport ?? sport;
    const range = SKILL_RANGES[nextSport];
    setSport(nextSport);
    setClubId(defaultClubId ?? '');
    setStartAt(getDefaultStartAt());
    setLevelMin(range.min);
    setLevelMax(Math.min(range.max, range.min + 1));
    setPlayersNeeded(3);
    setNote('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedClub) {
      toast.error('Select a club before creating a game.');
      return;
    }

    const range = SKILL_RANGES[sport];
    if (levelMin < range.min || levelMax > range.max || levelMin > levelMax) {
      toast.error(`Level range must be between ${range.min.toFixed(1)} and ${range.max.toFixed(1)}.`);
      return;
    }

    if (playersNeeded < 1) {
      toast.error('Players needed must be at least 1.');
      return;
    }

    const startTime = new Date(startAt).getTime();
    if (Number.isNaN(startTime) || startTime <= Date.now()) {
      toast.error('Choose a future date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createActivity({
        sport,
        title: `${sport} Game at ${selectedClub.name}`,
        description: note.trim() || undefined,
        location: {
          clubId: selectedClub._id,
          city: selectedClub.city,
          name: selectedClub.name,
          address: selectedClub.address,
          postalCode: selectedClub.postalCode
        },
        startTime,
        requirements: {
          levelMin,
          levelMax,
          slotsTotal: playersNeeded + 1
        },
        broadcast: true
      });

      toast.success('Game created.');
      setOpen(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create game.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveFormContainer
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button>
          <PlusCircle className="mr-1.5 size-4" />
          Create Game
        </Button>
      }
      drawerContentProps={{ className: 'max-h-[90vh]' }}
      sheetContentProps={{ className: 'sm:max-w-md' }}
    >
      <DrawerHeader className="text-left md:hidden">
        <DrawerTitle>Create Game</DrawerTitle>
        <DrawerDescription>Post a game at your club and notify matching players.</DrawerDescription>
      </DrawerHeader>

      <div className="hidden md:block">
        <SheetHeader>
          <SheetTitle>Create Game</SheetTitle>
          <SheetDescription>Post a game at your club and notify matching players.</SheetDescription>
        </SheetHeader>
      </div>

      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="space-y-4 overflow-y-auto px-6 pb-4">
          <div className="space-y-1.5">
            <Label>Sport</Label>
            <Select value={sport} onValueChange={value => setSport(value as Sport)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
              <SelectContent>
                {SPORT_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Club</Label>
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select club" />
              </SelectTrigger>
              <SelectContent>
                {(clubs ?? []).map(club => (
                  <SelectItem key={club._id} value={club._id}>
                    {club.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-game-start">Date & Time</Label>
            <Input
              id="create-game-start"
              type="datetime-local"
              value={startAt}
              onChange={event => setStartAt(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-game-level-min">Level Min</Label>
              <Input
                id="create-game-level-min"
                type="number"
                step={0.1}
                min={SKILL_RANGES[sport].min}
                max={SKILL_RANGES[sport].max}
                value={levelMin}
                onChange={event => setLevelMin(Number(event.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-game-level-max">Level Max</Label>
              <Input
                id="create-game-level-max"
                type="number"
                step={0.1}
                min={SKILL_RANGES[sport].min}
                max={SKILL_RANGES[sport].max}
                value={levelMax}
                onChange={event => setLevelMax(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-game-players-needed">Players Needed</Label>
            <Input
              id="create-game-players-needed"
              type="number"
              min={1}
              max={8}
              step={1}
              value={playersNeeded}
              onChange={event => setPlayersNeeded(Number(event.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-game-note">Note (Optional)</Label>
            <Textarea
              id="create-game-note"
              rows={4}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Any extra details for players joining this game."
            />
          </div>
        </div>

        <DrawerFooter className="border-t md:hidden">
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Publish Game
            </Button>
          </div>
        </DrawerFooter>

        <SheetFooter className="hidden border-t md:flex">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Publish Game
          </Button>
        </SheetFooter>
      </form>
    </ResponsiveFormContainer>
  );
}
