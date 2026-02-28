'use client';

import * as React from 'react';

import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, MessageCircle, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';
import { getAvailabilitySummary, getSkillLabel } from '@/lib/schema/ui-helpers';

import type { MatchingPlayer, SportProfileDoc } from './types';

interface PlayersBucketProps {
  limit?: number;
  hideSearch?: boolean;
  showFinderLink?: boolean;
  showTitle?: boolean;
}

function getLevelText(profile: MatchingPlayer['profile']): string {
  if (profile.sport === 'Padel') {
    if (profile.playtomicRating !== undefined) {
      return `Playtomic ${profile.playtomicRating.toFixed(1)}`;
    }
    if (profile.wprRating !== undefined) {
      return `WPR ${profile.wprRating.toFixed(1)}`;
    }
  }

  if (profile.skillLevel !== undefined) {
    return `Level ${profile.skillLevel.toFixed(1)} · ${getSkillLabel(profile.sport, profile.skillLevel)}`;
  }

  return 'Level not set';
}

export function PlayersBucket({
  limit = 50,
  hideSearch = false,
  showFinderLink = false,
  showTitle = true
}: PlayersBucketProps) {
  const navigate = useNavigate();
  const createDM = useMutation(api.conversations.createDM);
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const clubs = useQuery(api.clubs.listClubs, {});
  const [selectedSport, setSelectedSport] = React.useState<Sport | null>(null);
  const [search, setSearch] = React.useState('');
  const [messageTargetId, setMessageTargetId] = React.useState<Id<'users'> | null>(null);

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

  const matches = useQuery(
    api.sportProfiles.findMatchingPlayers,
    selectedProfile ? { profileId: selectedProfile._id, limit } : 'skip'
  );

  const clubById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const club of clubs ?? []) {
      map.set(club._id, club.name);
    }
    return map;
  }, [clubs]);

  const selectedClubId = selectedProfile?.homeClubId;
  const selectedClubName = selectedClubId ? clubById.get(selectedClubId) : null;

  const clubMatches = React.useMemo(() => {
    if (!matches || !selectedClubId) return [];
    return matches.filter(match => match.profile.homeClubId === selectedClubId);
  }, [matches, selectedClubId]);

  const filteredMatches = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return clubMatches;
    }

    return clubMatches.filter(match => {
      return (
        match.user.username.toLowerCase().includes(normalizedSearch) ||
        (selectedClubName ?? '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [clubMatches, search, selectedClubName]);

  const sportOptions = React.useMemo(() => {
    return Array.from(new Set((profiles ?? []).map(profile => profile.sport)));
  }, [profiles]);

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

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showTitle && (
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="size-5" />
                Who can I play with?
              </CardTitle>
              <CardDescription>Players at your club with similar level and preferences.</CardDescription>
            </div>
          )}

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
        </div>

        {!hideSearch && (
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search players"
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {profiles === undefined || clubs === undefined ? (
          <div className="text-muted-foreground text-sm">Loading players…</div>
        ) : profiles.length === 0 ? (
          <div className="bg-muted/40 space-y-3 rounded-xl border p-4 text-sm">
            <p className="font-medium">Create a Sport Passport to start matching players.</p>
            <Button asChild size="sm">
              <Link to="/profile">Set up passport</Link>
            </Button>
          </div>
        ) : !selectedClubId ? (
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Add a home club in your passport to see player matches.
          </div>
        ) : matches === undefined ? (
          <div className="text-muted-foreground text-sm">Finding players at {selectedClubName ?? 'your club'}…</div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            No player matches found at {selectedClubName ?? 'your club'}.
          </div>
        ) : (
          filteredMatches.slice(0, limit).map(match => {
            const isMessaging = messageTargetId === match.user._id;
            return (
              <div key={match.profile._id} className="bg-muted/35 space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">@{match.user.username}</p>
                    <p className="text-muted-foreground text-sm">{getLevelText(match.profile)}</p>
                  </div>
                  <Badge variant="secondary">Match {Math.round(match.score)}</Badge>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{selectedClubName ?? 'Club'}</Badge>
                  {match.profile.availability ? (
                    <span>{getAvailabilitySummary(match.profile.availability)}</span>
                  ) : (
                    <span>No availability set</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`/u/${match.user.username}`}>View Profile</a>
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
          })
        )}
        {showFinderLink && filteredMatches.length > 0 && (
          <div className="pt-1 text-center">
            <Link to="/finder" className="text-primary text-xs font-medium hover:underline">
              Explore all in Finder →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
