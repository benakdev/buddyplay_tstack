'use client';

import * as React from 'react';

import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { ChevronDown, ChevronUp, Loader2, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';
import { getAvailabilitySummary, getSkillLabel } from '@/lib/schema/ui-helpers';
import { cn } from '@/lib/utils';

import type { MatchingPlayer } from '../dashboard/types';

interface FinderPlayersTabProps {
  search: string;
  sport: Sport | null;
}

function getLevelText(profile: MatchingPlayer['profile']): string {
  if (profile.sport === 'Padel') {
    if (profile.playtomicRating !== undefined) return `Playtomic ${profile.playtomicRating.toFixed(1)}`;
    if (profile.wprRating !== undefined) return `WPR ${profile.wprRating.toFixed(1)}`;
  }
  if (profile.skillLevel !== undefined) {
    return `Level ${profile.skillLevel.toFixed(1)} · ${getSkillLabel(profile.sport, profile.skillLevel)}`;
  }
  return 'Level not set';
}

function ScoreBar({ percentage }: { percentage: number }) {
  const pct = Math.min(100, Math.max(0, percentage));
  return (
    <div className="bg-muted flex h-1.5 w-16 overflow-hidden rounded-full">
      <div className="bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function getRenderableMatchPercentage(matchPercentage: number | null | undefined): number | null {
  return typeof matchPercentage === 'number' && Number.isFinite(matchPercentage) ? matchPercentage : null;
}

export function FinderPlayersTab({ search, sport }: FinderPlayersTabProps) {
  const navigate = useNavigate();
  const createDM = useMutation(api.conversations.createDM);

  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const clubs = useQuery(api.clubs.listClubs, sport ? { sport } : {});

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedClubId, setSelectedClubId] = React.useState<string>('__any__');
  const [messageTargetId, setMessageTargetId] = React.useState<Id<'users'> | null>(null);

  // Resolve the profile for the selected sport
  const activeProfile = React.useMemo(() => {
    if (!profiles || !sport) return null;
    return profiles.find(p => p.sport === sport) ?? null;
  }, [profiles, sport]);

  // Set default club filter to user's home club when profile loads
  React.useEffect(() => {
    if (activeProfile?.homeClubId && selectedClubId === '__any__') {
      setSelectedClubId(activeProfile.homeClubId);
    }
  }, [activeProfile, selectedClubId]);

  const matches = useQuery(
    api.sportProfiles.findMatchingPlayers,
    activeProfile ? { profileId: activeProfile._id, limit: 20 } : 'skip'
  );

  const clubById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const club of clubs ?? []) map.set(club._id, club.name);
    return map;
  }, [clubs]);

  // Determine if search is @username mode
  const isUsernameSearch = search.startsWith('@');
  const normalizedSearch = isUsernameSearch ? search.slice(1).toLowerCase() : search.toLowerCase();

  const filtered = React.useMemo(() => {
    if (!matches) return [];
    return matches.filter(match => {
      // Club filter
      if (selectedClubId !== '__any__' && match.profile.homeClubId !== selectedClubId) return false;
      // Search filter
      if (normalizedSearch) {
        const username = match.user.username.toLowerCase();
        if (isUsernameSearch) return username.startsWith(normalizedSearch);
        return username.includes(normalizedSearch);
      }
      return true;
    });
  }, [matches, selectedClubId, normalizedSearch, isUsernameSearch]);

  const handleMessage = async (userId: Id<'users'>) => {
    setMessageTargetId(userId);
    try {
      const conversationId = await createDM({ otherUserId: userId });
      void navigate({
        to: '/inbox',
        search: { conversationId: String(conversationId) }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open conversation.';
      toast.error(message);
    } finally {
      setMessageTargetId(null);
    }
  };

  // No profile for selected sport
  if (profiles !== undefined && !activeProfile) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Create a {sport ?? 'sport'} passport to discover matching players.
          </p>
          <Button asChild size="sm">
            <Link to="/profile">Set up passport</Link>
          </Button>
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
        {selectedClubId !== '__any__' && (
          <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
            {clubById.get(selectedClubId) ?? 'Club'}
          </span>
        )}
      </button>

      {filtersOpen && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border p-3">
          {/* Club picker */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Club</span>
            <Select value={selectedClubId} onValueChange={setSelectedClubId}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Any club" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any club</SelectItem>
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
      {matches === undefined || profiles === undefined ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/40 flex items-center gap-3 rounded-xl border p-4">
              <div className="bg-muted size-10 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-3 w-28 animate-pulse rounded" />
                <div className="bg-muted h-2.5 w-20 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {normalizedSearch
                ? `No players matching "${search}".`
                : 'No matching players found. Try adjusting your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(match => {
            const isMessaging = messageTargetId === match.user._id;
            const clubName = match.profile.homeClubId ? (clubById.get(match.profile.homeClubId) ?? null) : null;
            const matchPercentage = getRenderableMatchPercentage(match.matchPercentage);
            return (
              <div
                key={match.profile._id}
                className={cn('bg-card hover:bg-muted/30 space-y-3 rounded-xl border p-4 transition-colors')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">@{match.user.username}</p>
                    <p className="text-muted-foreground text-sm">{getLevelText(match.profile)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {matchPercentage !== null ? (
                      <>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 border font-semibold"
                        >
                          {Math.round(matchPercentage)}% match
                        </Badge>
                        <ScoreBar percentage={matchPercentage} />
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  {clubName && <Badge variant="outline">{clubName}</Badge>}
                  {match.profile.availability ? (
                    <span>{getAvailabilitySummary(match.profile.availability)}</span>
                  ) : (
                    <span>No availability set</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/u/$username" params={{ username: match.user.username }}>
                      View Profile
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => handleMessage(match.user._id)} disabled={isMessaging}>
                    {isMessaging ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <MessageCircle className="mr-1.5 size-4" />
                    )}
                    Message
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
