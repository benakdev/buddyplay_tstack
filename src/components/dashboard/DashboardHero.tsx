'use client';

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';

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

export function DashboardHero() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});

  const firstProfile = profiles?.[0];

  return (
    <div className="flex items-start justify-between gap-4">
      {/* Greeting */}
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          {getFormattedDate()}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {getGreeting()}
          {currentUser ? (
            <>
              , <span className="text-primary">@{currentUser.username}</span>
            </>
          ) : null}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Here&apos;s what&apos;s happening at your clubs today.</p>
      </div>

      {/* Always-visible Host CTA */}
      <div className="shrink-0 pt-1">
        <CreateGameSheet defaultSport={firstProfile?.sport} defaultClubId={firstProfile?.homeClubId} />
      </div>
    </div>
  );
}
