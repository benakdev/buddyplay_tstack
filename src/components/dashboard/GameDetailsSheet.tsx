'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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

  const sheetContent = activityItem ? (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 md:px-0 md:pb-0">
      <div className="bg-muted/20 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{activityItem.activity.title}</h2>
            <p className="text-muted-foreground text-sm">Hosted by @{activityItem.creator.username}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {Math.max(0, activityItem.activity.requirements.slotsTotal - activityItem.activity.joinedCount)} spots left
          </Badge>
        </div>

        <div className="text-muted-foreground mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0" />
            <span>{formatGameTime(activityItem.activity.startTime)}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              {club?.name ?? activityItem.activity.location.name ?? 'Club not set'}
              {activityItem.activity.location.address ? `, ${activityItem.activity.location.address}` : ''}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">
            Levels {activityItem.activity.requirements.levelMin.toFixed(1)} -{' '}
            {activityItem.activity.requirements.levelMax.toFixed(1)}
          </Badge>
          <Badge variant="outline">
            {activityItem.activity.joinedCount}/{activityItem.activity.requirements.slotsTotal} players
          </Badge>
          {currentParticipant?.status === 'JOINED' && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Joined</Badge>
          )}
          {request?.status === 'PENDING' && <Badge>Request pending</Badge>}
          {request?.status === 'REJECTED' && <Badge variant="destructive">Request declined</Badge>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4" />
          <h3 className="font-medium">Who&apos;s in</h3>
        </div>
        {participants === undefined ? (
          <p className="text-muted-foreground text-sm">Loading players…</p>
        ) : joinedParticipants.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border p-3 text-sm">No players joined yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {joinedParticipants.map(participant => (
              <div
                key={participant._id}
                className="bg-muted/35 flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
              >
                <span>@{participant.username}</span>
                <Badge variant="outline">{participant.joinedVia ?? 'JOINED'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="text-muted-foreground px-4 pb-4 text-sm">Loading game details…</div>
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

      <DrawerFooter className="border-t md:hidden">
        <Button disabled={action.disabled || actionBusy !== null} onClick={handleAction}>
          {actionBusy === 'join'
            ? 'Sending…'
            : actionBusy === 'cancel'
              ? 'Cancelling…'
              : actionBusy === 'leave'
                ? 'Leaving…'
                : action.label}
        </Button>
      </DrawerFooter>
      <SheetFooter className="hidden border-t px-6 pb-6 md:flex">
        <Button disabled={action.disabled || actionBusy !== null} onClick={handleAction} className="w-full">
          {actionBusy === 'join'
            ? 'Sending…'
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
