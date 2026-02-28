'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

function formatGameTime(timestamp: number): string {
  return format(new Date(timestamp), 'EEE · MMM d, p');
}

export function MyUpcomingGamesCarousel() {
  const leaveActivity = useMutation(api.activities.leaveActivity);
  const cancelRequest = useMutation(api.requests.cancelRequest);
  const games = useQuery(api.activities.listMyUpcomingActivities, { limit: 8 });
  const [actionId, setActionId] = React.useState<Id<'activities'> | null>(null);

  const handleLeave = async (activityId: Id<'activities'>) => {
    setActionId(activityId);
    try {
      await leaveActivity({ activityId });
      toast.success('You left the game.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not leave game.';
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  const handleDiscard = async (activityId: Id<'activities'>, requestId: Id<'requests'> | null) => {
    if (!requestId) return;
    setActionId(activityId);
    try {
      await cancelRequest({ requestId });
      toast.success('Request cancelled.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not cancel request.';
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  if (games === undefined) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-muted/40 h-29.5 w-65 shrink-0 animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-muted/20 rounded-xl border px-5 py-6 text-center">
        <p className="text-muted-foreground text-sm">No upcoming games yet.</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">Find and join games in the Finder.</p>
      </div>
    );
  }

  return (
    <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
      <CarouselContent className="-ml-3">
        {games.map(item => {
          const spotsLeft = Math.max(0, item.activity.requirements.slotsTotal - item.activity.joinedCount);
          const isPending = item.participantStatus === 'PENDING';
          const isBusy = actionId === item.activity._id;

          return (
            <CarouselItem key={item.activity._id} className="basis-[min(280px,85vw)] pl-3">
              <div
                className={[
                  'flex h-full flex-col justify-between gap-3 rounded-xl border p-4 transition-colors',
                  isPending
                    ? 'border-amber-200/70 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20'
                    : 'bg-card hover:border-border/80'
                ].join(' ')}
              >
                {/* Status pill + Title */}
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                        isPending
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      ].join(' ')}
                    >
                      {isPending ? 'Pending' : 'Joined'}
                    </span>
                  </div>
                  <p className="line-clamp-2 font-semibold">{item.activity.title}</p>
                  <p className="text-muted-foreground text-xs">by @{item.creator.username}</p>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <CalendarClock className="size-3 shrink-0" />
                    <span className="line-clamp-1">{formatGameTime(item.activity.startTime)}</span>
                  </div>
                </div>

                {/* Spots + Level */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="h-5 text-[10px]">
                    {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="h-5 text-[10px]">
                    Lvl {item.activity.requirements.levelMin.toFixed(1)}–
                    {item.activity.requirements.levelMax.toFixed(1)}
                  </Badge>
                </div>

                {/* Action button */}
                {isPending ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isBusy || !item.requestId}
                    onClick={() => handleDiscard(item.activity._id, item.requestId)}
                    className="text-muted-foreground hover:text-foreground h-8 text-xs"
                  >
                    {isBusy ? 'Cancelling...' : 'Discard request'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => handleLeave(item.activity._id)}
                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5 h-8 text-xs"
                  >
                    {isBusy ? 'Leaving...' : 'Leave'}
                  </Button>
                )}
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}
