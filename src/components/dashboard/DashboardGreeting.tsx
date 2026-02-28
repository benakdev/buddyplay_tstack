'use client';

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';

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

export function DashboardGreeting() {
  const currentUser = useQuery(api.users.getCurrentUser, {});

  return (
    <div>
      <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{getFormattedDate()}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {getGreeting()}
        {currentUser ? <span className="text-primary">, @{currentUser.username}</span> : null}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">Here&apos;s what&apos;s happening at your clubs today.</p>
    </div>
  );
}
