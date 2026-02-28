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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';

import { CreateGameSheet } from './CreateGameSheet';
import { HostRequestsPanel } from './HostRequestsPanel';
import type { ActivityWithCreator, ClubDoc, SportProfileDoc } from './types';

interface GamesBucketProps {
  limit?: number;
  hideSearch?: boolean;
  hideHostPanel?: boolean;
  showFinderLink?: boolean;
  showTitle?: boolean;
}

function formatGameTime(timestamp: number): string {
  return format(new Date(timestamp), 'EEE, MMM d · p');
}

export function GamesBucket({
  limit = 40,
  hideSearch = false,
  hideHostPanel = false,
  showFinderLink = false,
  showTitle = true
}: GamesBucketProps) {
  const createRequest = useMutation(api.requests.createRequest);
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myRequests = useQuery(api.requests.getMyRequests, {});
  const clubs = useQuery(api.clubs.listClubs, {});

  const [selectedSport, setSelectedSport] = React.useState<Sport | null>(null);
  const [search, setSearch] = React.useState('');
  const [requestingActivityId, setRequestingActivityId] = React.useState<Id<'activities'> | null>(null);

  React.useEffect(() => {
    if (!profiles || profiles.length === 0) {
      return;
    }

    const hasSelectedSport = selectedSport && profiles.some(profile => profile.sport === selectedSport);
    if (!hasSelectedSport) {
      setSelectedSport(profiles[0].sport);
    }
  }, [profiles, selectedSport]);

  const selectedProfile: SportProfileDoc | null = React.useMemo(() => {
    if (!profiles || !selectedSport) return null;
    return profiles.find(profile => profile.sport === selectedSport) ?? null;
  }, [profiles, selectedSport]);

  const selectedClubId = selectedProfile?.homeClubId;

  const selectedClub: ClubDoc | undefined = React.useMemo(() => {
    if (!selectedClubId || !clubs) return undefined;
    return clubs.find(club => club._id === selectedClubId);
  }, [clubs, selectedClubId]);

  const games = useQuery(
    api.activities.listActivitiesByClub,
    selectedSport && selectedClubId
      ? {
          sport: selectedSport,
          clubId: selectedClubId,
          limit
        }
      : 'skip'
  );

  const requestByActivityId = React.useMemo(() => {
    const map = new Map<string, 'PENDING' | 'APPROVED' | 'REJECTED'>();
    for (const item of myRequests ?? []) {
      map.set(item.activity._id, item.request.status);
    }
    return map;
  }, [myRequests]);

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

  const sportOptions = React.useMemo(() => {
    return Array.from(new Set((profiles ?? []).map(profile => profile.sport)));
  }, [profiles]);

  const getActionState = (item: ActivityWithCreator): { label: string; disabled: boolean } => {
    if (!currentUser) {
      return { label: 'Sign in', disabled: true };
    }

    if (item.activity.creatorId === currentUser._id) {
      return { label: 'Your Game', disabled: true };
    }

    const requestStatus = requestByActivityId.get(item.activity._id);
    if (requestStatus === 'PENDING') {
      return { label: 'Requested', disabled: true };
    }

    if (requestStatus === 'APPROVED') {
      return { label: 'Joined', disabled: true };
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {showTitle && (
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="size-5" />
                  What games can I join?
                </CardTitle>
                <CardDescription>
                  Open games at {selectedClub?.name ?? 'your club'} with request-based joining.
                </CardDescription>
              </div>
            )}

            <div className="flex items-center gap-2">
              {sportOptions.length > 0 && (
                <Select value={selectedSport ?? undefined} onValueChange={value => setSelectedSport(value as Sport)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sportOptions.map(sport => (
                      <SelectItem key={sport} value={sport}>
                        {sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <CreateGameSheet defaultSport={selectedSport ?? undefined} defaultClubId={selectedClubId} />
            </div>
          </div>

          {!hideSearch && (
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search games"
                className="pl-9"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {profiles === undefined || clubs === undefined || myRequests === undefined ? (
            <div className="text-muted-foreground text-sm">Loading games…</div>
          ) : profiles.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border p-4 text-sm">
              Create a Sport Passport to discover and host games.
            </div>
          ) : !selectedClubId ? (
            <div className="text-muted-foreground rounded-xl border p-4 text-sm">
              Add a home club in your passport to see club games.
            </div>
          ) : games === undefined ? (
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
                <div key={item.activity._id} className="bg-muted/35 space-y-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{item.activity.title}</p>
                      <p className="text-muted-foreground text-sm">Hosted by @{item.creator.username}</p>
                    </div>
                    <Badge variant="secondary">{spotsLeft} spots left</Badge>
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

                  <Button
                    size="sm"
                    variant={action.disabled ? 'outline' : 'default'}
                    disabled={action.disabled || isRequesting}
                    onClick={() => handleRequestJoin(item.activity._id)}
                  >
                    {isRequesting ? 'Sending…' : action.label}
                  </Button>
                </div>
              );
            })
          )}
          {showFinderLink && filteredGames.length > 0 && (
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
