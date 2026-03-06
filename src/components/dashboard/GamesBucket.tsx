'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { CalendarClock, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { GameDetailsSheet } from './GameDetailsSheet';
import { HostRequestsPanel } from './HostRequestsPanel';
import type { ActivityWithCreator, ClubDoc, SportProfileDoc } from './types';

interface GamesBucketProps {
  limit?: number;
  hideSearch?: boolean;
  hideHostPanel?: boolean;
  showFinderLink?: boolean;
  showTitle?: boolean;
  selectedProfileId?: Id<'userSportProfiles'> | null;
}

function formatGameTime(timestamp: number): string {
  return format(new Date(timestamp), 'EEE, MMM d · p');
}

export function GamesBucket({
  limit = 40,
  hideSearch = false,
  hideHostPanel = false,
  showFinderLink = false,
  showTitle = true,
  selectedProfileId = null
}: GamesBucketProps) {
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const [search, setSearch] = React.useState('');
  const visibleProfiles = React.useMemo(() => {
    if (!profiles) return undefined;
    const filteredProfiles = selectedProfileId
      ? profiles.filter(profile => profile._id === selectedProfileId)
      : profiles;

    return filteredProfiles.filter(profile => profile.homeClubId);
  }, [profiles, selectedProfileId]);

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/85 overflow-hidden rounded-3xl shadow-sm">
        <CardHeader className="gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {showTitle && (
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="size-5" />
                  What games can I join?
                </CardTitle>
                <CardDescription>Open games across your selected passports with request-based joining.</CardDescription>
              </div>
            )}
          </div>

          {!hideSearch && (
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search games"
                className="h-11 rounded-xl pl-9"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {profiles === undefined ? (
            <div className="text-muted-foreground text-sm">Loading games…</div>
          ) : profiles.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border p-4 text-sm">
              Create a Sport Passport to discover and host games.
            </div>
          ) : !visibleProfiles || visibleProfiles.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border p-4 text-sm">
              Add a home club in at least one passport to see club games.
            </div>
          ) : (
            visibleProfiles.map(profile => (
              <GamesBucketSection key={profile._id} limit={limit} profile={profile} search={search} />
            ))
          )}
          {showFinderLink && visibleProfiles && visibleProfiles.length > 0 && (
            <div className="pt-1 text-center">
              <a href="/finder" className="text-primary text-xs font-medium hover:underline">
                Explore all in Finder →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {!hideHostPanel && <HostRequestsPanel />}
    </div>
  );
}

function GamesBucketSection({ limit, profile, search }: { limit: number; profile: SportProfileDoc; search: string }) {
  const clubs = useQuery(api.clubs.listClubs, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myRequests = useQuery(api.requests.getMyRequests, {});
  const myUpcomingGames = useQuery(api.activities.listMyUpcomingActivities, { limit: 50 });
  const createRequest = useMutation(api.requests.createRequest);
  const [requestingActivityId, setRequestingActivityId] = React.useState<Id<'activities'> | null>(null);

  const games = useQuery(
    api.activities.listActivitiesByClub,
    profile.homeClubId
      ? {
          sport: profile.sport,
          clubId: profile.homeClubId,
          limit
        }
      : 'skip'
  );

  const selectedClub: ClubDoc | undefined = React.useMemo(() => {
    if (!profile.homeClubId || !clubs) return undefined;
    return clubs.find(club => club._id === profile.homeClubId);
  }, [clubs, profile.homeClubId]);

  const requestByActivityId = React.useMemo(() => {
    const map = new Map<string, 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>();
    for (const item of myRequests ?? []) {
      map.set(item.activity._id, item.request.status);
    }
    return map;
  }, [myRequests]);

  const joinedActivityIds = React.useMemo(() => {
    return new Set(
      (myUpcomingGames ?? []).filter(item => item.participantStatus === 'JOINED').map(item => item.activity._id)
    );
  }, [myUpcomingGames]);

  const filteredGames = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!games) return [];
    if (!normalizedSearch) return games;

    return games.filter(item => {
      return (
        item.activity.title.toLowerCase().includes(normalizedSearch) ||
        item.creator.username.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [games, search]);

  const getActionState = (item: ActivityWithCreator): { label: string; disabled: boolean } => {
    if (!currentUser) {
      return { label: 'Sign in', disabled: true };
    }

    if (item.activity.creatorId === currentUser._id) {
      return { label: 'Your game', disabled: true };
    }

    if (joinedActivityIds.has(item.activity._id)) {
      return { label: 'Joined', disabled: true };
    }

    const requestStatus = requestByActivityId.get(item.activity._id);
    if (requestStatus === 'PENDING') {
      return { label: 'Requested', disabled: true };
    }

    if (requestStatus === 'REJECTED') {
      return { label: 'Declined', disabled: true };
    }

    if (item.activity.status !== 'OPEN') {
      return { label: item.activity.status, disabled: true };
    }

    return { label: 'Request to Join', disabled: false };
  };

  const handleRequestJoin = async (activityId: Id<'activities'>) => {
    setRequestingActivityId(activityId);
    try {
      await createRequest({ activityId });
      toast.success('Join request sent.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send request.';
      toast.error(message);
    } finally {
      setRequestingActivityId(null);
    }
  };

  return (
    <div className="border-border/70 bg-muted/10 space-y-3 rounded-2xl border border-dashed p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{profile.sport}</p>
          <p className="text-muted-foreground text-xs">{selectedClub?.name ?? 'Your club'}</p>
        </div>
        <Badge variant="outline">Passport</Badge>
      </div>

      {games === undefined ? (
        <div className="text-muted-foreground text-sm">Loading games at {selectedClub?.name ?? 'your club'}…</div>
      ) : filteredGames.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border p-4 text-sm">
          No open games found at {selectedClub?.name ?? 'your club'}.
        </div>
      ) : (
        filteredGames.map(item => {
          const action = getActionState(item);
          const spotsLeft = Math.max(0, item.activity.requirements.slotsTotal - item.activity.joinedCount);
          const isRequesting = requestingActivityId === item.activity._id;
          return (
            <div
              key={item.activity._id}
              className="bg-background/80 border-border/70 space-y-3 rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 leading-snug font-medium">{item.activity.title}</p>
                  <p className="text-muted-foreground text-sm">Hosted by @{item.creator.username}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {spotsLeft} spots left
                </Badge>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">
                  Levels {item.activity.requirements.levelMin.toFixed(1)} -{' '}
                  {item.activity.requirements.levelMax.toFixed(1)}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  {formatGameTime(item.activity.startTime)}
                </span>
              </div>

              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <GameDetailsSheet
                  activityId={item.activity._id}
                  trigger={
                    <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto">
                      View game
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant={action.disabled ? 'outline' : 'default'}
                  disabled={action.disabled || isRequesting}
                  onClick={() => handleRequestJoin(item.activity._id)}
                  className="h-10 w-full sm:w-auto"
                >
                  {isRequesting ? 'Sending…' : action.label}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
