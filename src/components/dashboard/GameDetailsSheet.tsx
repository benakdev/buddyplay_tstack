'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

interface GameDetailsSheetProps {
  activityId: Id<'activities'>;
  trigger: React.ReactNode;
}

function formatGameTime(timestamp: number): string {
  return format(new Date(timestamp), 'EEEE, MMM d · p');
}

export function GameDetailsSheet({ activityId, trigger }: GameDetailsSheetProps) {
  const [open, setOpen] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState<'join' | 'cancel' | 'leave' | null>(null);

  const activityItem = useQuery(api.activities.getActivityWithCreator, { activityId });
  const participants = useQuery(api.activities.getActivityParticipants, { activityId });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myRequests = useQuery(api.requests.getMyRequests, {});
  const clubs = useQuery(api.clubs.listClubs, {});

  const createRequest = useMutation(api.requests.createRequest);
  const cancelRequest = useMutation(api.requests.cancelRequest);
  const leaveActivity = useMutation(api.activities.leaveActivity);

  const request = React.useMemo(
    () => myRequests?.find(item => item.activity._id === activityId)?.request ?? null,
    [activityId, myRequests]
  );

  const currentParticipant = React.useMemo(
    () => participants?.find(participant => participant.userId === currentUser?._id) ?? null,
    [currentUser?._id, participants]
  );

  const joinedParticipants = React.useMemo(
    () => participants?.filter(participant => participant.status === 'JOINED') ?? [],
    [participants]
  );

  const club = React.useMemo(() => {
    if (!activityItem?.activity.location.clubId || !clubs) return null;
    return clubs.find(item => item._id === activityItem.activity.location.clubId) ?? null;
  }, [activityItem, clubs]);

  const action = React.useMemo(() => {
    if (!activityItem || !currentUser) {
      return { label: 'Loading…', intent: null as 'join' | 'cancel' | 'leave' | null, disabled: true };
    }

    if (activityItem.activity.creatorId === currentUser._id) {
      return { label: 'Your game', intent: null as 'join' | 'cancel' | 'leave' | null, disabled: true };
    }

    if (currentParticipant?.status === 'JOINED') {
      return { label: 'Leave game', intent: 'leave' as const, disabled: false };
    }

    if (request?.status === 'PENDING') {
      return { label: 'Cancel request', intent: 'cancel' as const, disabled: false };
    }

    if (request?.status === 'REJECTED') {
      return { label: 'Request declined', intent: null as 'join' | 'cancel' | 'leave' | null, disabled: true };
    }

    if (activityItem.activity.status !== 'OPEN') {
      return {
        label: activityItem.activity.status,
        intent: null as 'join' | 'cancel' | 'leave' | null,
        disabled: true
      };
    }

    return { label: 'Request to join', intent: 'join' as const, disabled: false };
  }, [activityItem, currentParticipant?.status, currentUser, request?.status]);

  const handleAction = async () => {
    if (!action.intent || !activityItem) {
      return;
    }

    setActionBusy(action.intent);
    try {
      if (action.intent === 'join') {
        await createRequest({ activityId });
        toast.success('Join request sent.');
      }

      if (action.intent === 'cancel' && request) {
        await cancelRequest({ requestId: request._id });
        toast.success('Request cancelled.');
      }

      if (action.intent === 'leave') {
        await leaveActivity({ activityId });
        toast.success('You left the game.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update this game.';
      toast.error(message);
    } finally {
      setActionBusy(null);
    }
  };

  const spotsLeft = activityItem
    ? Math.max(0, activityItem.activity.requirements.slotsTotal - activityItem.activity.joinedCount)
    : 0;

  const sheetContent = activityItem ? (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 md:px-0 md:pb-0">
      {/* Main game card */}
      <div className="bg-card overflow-hidden rounded-2xl border">
        {/* Accent top bar */}
        <div className="bg-primary h-1 w-full" />
        <div className="p-4 sm:p-5">
          {/* Title + spots left */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg leading-tight font-bold tracking-tight sm:text-xl">
                {activityItem.activity.title}
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Hosted by <span className="text-foreground font-medium">@{activityItem.creator.username}</span>
              </p>
            </div>
            <div
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                spotsLeft === 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/15 text-primary'
              }`}
            >
              {spotsLeft === 0 ? 'Full' : `${spotsLeft} spots left`}
            </div>
          </div>

          {/* Divider */}
          <div className="border-border/50 my-3.5 border-t" />

          {/* Date & Location */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 text-sm">
              <div className="bg-muted mt-0.5 shrink-0 rounded-lg p-1.5">
                <CalendarClock className="text-muted-foreground size-3.5" />
              </div>
              <span className="text-foreground leading-snug">{formatGameTime(activityItem.activity.startTime)}</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <div className="bg-muted mt-0.5 shrink-0 rounded-lg p-1.5">
                <MapPin className="text-muted-foreground size-3.5" />
              </div>
              <span className="text-foreground leading-snug">
                {club?.name ?? activityItem.activity.location.name ?? 'Club not set'}
                {activityItem.activity.location.address ? `, ${activityItem.activity.location.address}` : ''}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-border/50 my-3.5 border-t" />

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
              Levels {activityItem.activity.requirements.levelMin.toFixed(1)}–
              {activityItem.activity.requirements.levelMax.toFixed(1)}
            </span>
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
              <Users className="mr-1 inline size-3" />
              {activityItem.activity.joinedCount}/{activityItem.activity.requirements.slotsTotal} players
            </span>

            {currentParticipant?.status === 'JOINED' && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                Joined
              </span>
            )}
            {request?.status === 'PENDING' && (
              <span className="bg-primary/15 text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
                Request pending
              </span>
            )}
            {request?.status === 'REJECTED' && (
              <span className="bg-destructive/15 text-destructive rounded-full px-2.5 py-1 text-xs font-semibold">
                Request declined
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Who's in section */}
      <div className="bg-card rounded-2xl border p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground size-4" />
            <h3 className="text-sm font-semibold">Who&apos;s in</h3>
          </div>
          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
            {joinedParticipants.length} / {activityItem.activity.requirements.slotsTotal}
          </span>
        </div>

        {participants === undefined ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="bg-muted/40 h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : joinedParticipants.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed py-4 text-center text-sm">
            No players joined yet
          </p>
        ) : (
          <div className="space-y-2">
            {joinedParticipants.map(participant => {
              const isCreator = participant.userId === activityItem.activity.creatorId;
              const initials = participant.username.slice(0, 2).toUpperCase();
              return (
                <div
                  key={participant._id}
                  className="bg-muted/30 flex items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <div className="bg-primary/20 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {initials}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">@{participant.username}</span>
                  {isCreator && (
                    <span className="bg-primary/15 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                      Creator
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-4 md:px-0 md:pb-0">
      <div className="bg-muted/40 h-48 animate-pulse rounded-2xl" />
      <div className="bg-muted/40 h-32 animate-pulse rounded-2xl" />
    </div>
  );

  return (
    <ResponsiveFormContainer
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      drawerContentProps={{ className: 'max-h-[92vh]' }}
      sheetContentProps={{ className: 'flex h-full flex-col sm:max-w-lg' }}
    >
      <DrawerHeader className="text-left md:hidden">
        <DrawerTitle>Game details</DrawerTitle>
        <DrawerDescription>Review the match, players, and your join status.</DrawerDescription>
      </DrawerHeader>
      <div className="hidden px-6 pt-6 md:block">
        <SheetHeader>
          <SheetTitle>Game details</SheetTitle>
          <SheetDescription>Review the match, players, and your join status.</SheetDescription>
        </SheetHeader>
      </div>

      {sheetContent}

      <DrawerFooter className="bg-background/80 border-t backdrop-blur-sm md:hidden">
        <Button
          disabled={action.disabled || actionBusy !== null}
          onClick={handleAction}
          size="lg"
          className="w-full rounded-xl"
        >
          {actionBusy === 'join'
            ? 'Sending request…'
            : actionBusy === 'cancel'
              ? 'Cancelling…'
              : actionBusy === 'leave'
                ? 'Leaving…'
                : action.label}
        </Button>
      </DrawerFooter>
      <SheetFooter className="bg-background/80 hidden border-t px-6 py-4 backdrop-blur-sm md:flex">
        <Button
          disabled={action.disabled || actionBusy !== null}
          onClick={handleAction}
          size="lg"
          className="w-full rounded-xl"
        >
          {actionBusy === 'join'
            ? 'Sending request…'
            : actionBusy === 'cancel'
              ? 'Cancelling…'
              : actionBusy === 'leave'
                ? 'Leaving…'
                : action.label}
        </Button>
      </SheetFooter>
    </ResponsiveFormContainer>
  );
}
