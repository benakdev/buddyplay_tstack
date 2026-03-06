'use client';

import { useQuery } from 'convex/react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { CreateGameSheet } from './CreateGameSheet';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

interface DashboardHeroProps {
  selectedProfileId: Id<'userSportProfiles'> | null;
  onSelectedProfileChange: (value: Id<'userSportProfiles'> | null) => void;
}

export function DashboardHero({ selectedProfileId, onSelectedProfileChange }: DashboardHeroProps) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});

  const activeProfile = selectedProfileId
    ? profiles?.find(profile => profile._id === selectedProfileId)
    : profiles?.[0];

  return (
    <section className="border-border/70 rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted)/0.55)_100%)] p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">
            {getFormattedDate()}
          </p>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-balance sm:text-3xl md:text-4xl">
            {getGreeting()}
            {currentUser ? (
              <>
                , <span className="text-primary break-words">@{currentUser.username}</span>
              </>
            ) : null}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 sm:text-base">
            Track who to play with, what you&apos;ve joined, and the next actions waiting on you.
          </p>

          {profiles && profiles.length > 0 && (
            <div className="border-border/70 bg-background/70 mt-4 max-w-sm rounded-2xl border p-3">
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.2em] uppercase">
                Dashboard Focus
              </p>
              <Select
                value={selectedProfileId ?? 'all'}
                onValueChange={value =>
                  onSelectedProfileChange(value === 'all' ? null : (value as Id<'userSportProfiles'>))
                }
              >
                <SelectTrigger className="bg-background h-11 w-full rounded-xl">
                  <SelectValue placeholder="All passports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All passports</SelectItem>
                  {profiles.map(profile => (
                    <SelectItem key={profile._id} value={profile._id}>
                      {profile.sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="shrink-0 sm:pt-1">
          <CreateGameSheet defaultSport={activeProfile?.sport} defaultClubId={activeProfile?.homeClubId} />
        </div>
      </div>
    </section>
  );
}
