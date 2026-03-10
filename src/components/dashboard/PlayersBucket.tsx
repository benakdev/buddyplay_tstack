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
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getAvailabilitySummary, getSkillLabel } from '@/lib/schema/ui-helpers';

import type { MatchingPlayer, SportProfileDoc } from './types';

interface PlayersBucketProps {
  limit?: number;
  hideSearch?: boolean;
  showFinderLink?: boolean;
  showTitle?: boolean;
  selectedProfileId?: Id<'userSportProfiles'> | null;
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

function getRenderableMatchPercentage(matchPercentage: number | null | undefined): number | null {
  return typeof matchPercentage === 'number' && Number.isFinite(matchPercentage) ? matchPercentage : null;
}

export function PlayersBucket({
  limit = 50,
  hideSearch = false,
  showFinderLink = false,
  showTitle = true,
  selectedProfileId = null
}: PlayersBucketProps) {
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
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showTitle && (
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="size-5" />
                Who can I play with?
              </CardTitle>
              <CardDescription>
                Players across your selected passports with similar level and preferences.
              </CardDescription>
            </div>
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
        {profiles === undefined ? (
          <div className="text-muted-foreground text-sm">Loading players…</div>
        ) : profiles.length === 0 ? (
          <div className="bg-muted/40 space-y-3 rounded-xl border p-4 text-sm">
            <p className="font-medium">Create a Sport Passport to start matching players.</p>
            <Button asChild size="sm">
              <Link to="/profile">Set up passport</Link>
            </Button>
          </div>
        ) : !visibleProfiles || visibleProfiles.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Add a home club in at least one passport to see player matches.
          </div>
        ) : (
          visibleProfiles.map(profile => (
            <PlayersBucketSection key={profile._id} limit={limit} profile={profile} search={search} />
          ))
        )}
        {showFinderLink && visibleProfiles && visibleProfiles.length > 0 && (
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

function PlayersBucketSection({ limit, profile, search }: { limit: number; profile: SportProfileDoc; search: string }) {
  const navigate = useNavigate();
  const createDM = useMutation(api.conversations.createDM);
  const clubs = useQuery(api.clubs.listClubs, {});
  const matches = useQuery(api.sportProfiles.findMatchingPlayers, { profileId: profile._id, limit });
  const [messageTargetId, setMessageTargetId] = React.useState<Id<'users'> | null>(null);

  const clubById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const club of clubs ?? []) {
      map.set(club._id, club.name);
    }
    return map;
  }, [clubs]);

  const selectedClubName = profile.homeClubId ? clubById.get(profile.homeClubId) : null;

  const clubMatches = React.useMemo(() => {
    if (!matches || !profile.homeClubId) return [];
    return matches.filter(match => match.sameClub);
  }, [matches, profile.homeClubId]);

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
    <div className="space-y-3 rounded-2xl border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{profile.sport}</p>
          <p className="text-muted-foreground text-xs">{selectedClubName ?? 'Your club'}</p>
        </div>
        <Badge variant="outline">Passport</Badge>
      </div>

      {matches === undefined ? (
        <div className="text-muted-foreground text-sm">Finding players at {selectedClubName ?? 'your club'}…</div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border p-4 text-sm">
          No player matches found at {selectedClubName ?? 'your club'}.
        </div>
      ) : (
        filteredMatches.slice(0, limit).map(match => {
          const isMessaging = messageTargetId === match.user._id;
          const matchPercentage = getRenderableMatchPercentage(match.matchPercentage);
          return (
            <div key={match.profile._id} className="bg-muted/35 space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">@{match.user.username}</p>
                  <p className="text-muted-foreground text-sm">{getLevelText(match.profile)}</p>
                </div>
                {matchPercentage !== null ? (
                  <Badge variant="secondary">Match {Math.round(matchPercentage)}%</Badge>
                ) : null}
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
    </div>
  );
}
