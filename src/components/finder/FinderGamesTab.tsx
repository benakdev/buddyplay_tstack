'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { CalendarClock, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

import type { ActivityWithCreator } from '../dashboard/types';

interface FinderGamesTabProps {
  search: string;
  sport: Sport | null;
}

function formatGameTime(timestamp: number): string {
  return format(new Date(timestamp), 'EEE, MMM d · p');
}

export function FinderGamesTab({ search, sport }: FinderGamesTabProps) {
  const createRequest = useMutation(api.requests.createRequest);

  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myRequests = useQuery(api.requests.getMyRequests, {});
  const myUpcomingGames = useQuery(api.activities.listMyUpcomingActivities, { limit: 50 });
  const clubs = useQuery(api.clubs.listClubs, sport ? { sport } : {});

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedClubId, setSelectedClubId] = React.useState<string | null>(null);
  const [requestingActivityId, setRequestingActivityId] = React.useState<Id<'activities'> | null>(null);

  // Resolve active profile for this sport
  const activeProfile = React.useMemo(() => {
    if (!profiles || !sport) return null;
    return profiles.find(p => p.sport === sport) ?? null;
  }, [profiles, sport]);

  // Default selected club to the user's home club
  React.useEffect(() => {
    if (!selectedClubId && activeProfile?.homeClubId) {
      setSelectedClubId(activeProfile.homeClubId);
    }
  }, [activeProfile, selectedClubId]);

  const clubById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const club of clubs ?? []) map.set(club._id, club.name);
    return map;
  }, [clubs]);

  const effectiveClubId = selectedClubId ?? activeProfile?.homeClubId ?? null;

  const games = useQuery(
    api.activities.listActivitiesByClub,
    sport && effectiveClubId ? { sport, clubId: effectiveClubId as Id<'clubs'>, limit: 30 } : 'skip'
  );

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

  const normalizedSearch = search.toLowerCase();

  const filtered = React.useMemo(() => {
    if (!games) return [];
    if (!normalizedSearch) return games;
    return games.filter(
      item =>
        item.activity.title.toLowerCase().includes(normalizedSearch) ||
        item.creator.username.toLowerCase().includes(normalizedSearch)
    );
  }, [games, normalizedSearch]);

  const getActionState = (item: ActivityWithCreator): { label: string; disabled: boolean } => {
    if (!currentUser) return { label: 'Sign in', disabled: true };
    if (item.activity.creatorId === currentUser._id) return { label: 'Your Game', disabled: true };
    if (joinedActivityIds.has(item.activity._id)) return { label: 'Joined', disabled: true };
    const status = requestByActivityId.get(item.activity._id);
    if (status === 'PENDING') return { label: 'Requested', disabled: true };
    if (status === 'REJECTED') return { label: 'Declined', disabled: true };
    if (item.activity.status !== 'OPEN') return { label: item.activity.status, disabled: true };
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

  const currentClubName = effectiveClubId ? (clubById.get(effectiveClubId) ?? 'your club') : 'your club';

  if (profiles !== undefined && !activeProfile) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Create a {sport ?? 'sport'} passport to discover games at your club.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters toggle */}
      <button
        onClick={() => setFiltersOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <SlidersHorizontal className="size-3.5" />
        Filters
        {filtersOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {effectiveClubId && effectiveClubId !== '__any__' && (
          <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
            {clubById.get(effectiveClubId) ?? 'Club'}
          </span>
        )}
      </button>

      {filtersOpen && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Club</span>
            <Select value={effectiveClubId ?? '__loading__'} onValueChange={v => setSelectedClubId(v)}>
              <SelectTrigger className="h-8 w-44 text-xs">
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
        </div>
      )}

      {/* Results */}
      {games === undefined || profiles === undefined || myRequests === undefined ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/40 animate-pulse rounded-xl border p-4">
              <div className="space-y-2">
                <div className="bg-muted h-3 w-40 rounded" />
                <div className="bg-muted h-2.5 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !effectiveClubId ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">Add a home club in your passport to see games.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {normalizedSearch
                ? `No games matching "${search}" at ${currentClubName}.`
                : `No open games at ${currentClubName} right now.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const action = getActionState(item);
            const spotsLeft = Math.max(0, item.activity.requirements.slotsTotal - item.activity.joinedCount);
            const isRequesting = requestingActivityId === item.activity._id;
            const spotsColor = spotsLeft === 0 ? 'text-destructive' : spotsLeft <= 2 ? 'text-amber-500' : '';

            return (
              <div
                key={item.activity._id}
                className={cn('bg-card hover:bg-muted/30 space-y-3 rounded-xl border p-4 transition-colors')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold">{item.activity.title}</p>
                    <p className="text-muted-foreground text-sm">by @{item.creator.username}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('shrink-0 font-semibold', spotsColor && `${spotsColor} border border-current/20`)}
                  >
                    {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                  </Badge>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">
                    Lvl {item.activity.requirements.levelMin.toFixed(1)}–
                    {item.activity.requirements.levelMax.toFixed(1)}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {formatGameTime(item.activity.startTime)}
                  </span>
                  {effectiveClubId && <Badge variant="outline">{clubById.get(effectiveClubId) ?? 'Club'}</Badge>}
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
          })}
        </div>
      )}
    </div>
  );
}
