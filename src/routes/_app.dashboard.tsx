import { useEffect, useState } from 'react';

import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';

import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { DashboardNotificationsWidget } from '@/components/dashboard/DashboardNotificationsWidget';
import { GamesBucket } from '@/components/dashboard/GamesBucket';
import { HostActionsWidget } from '@/components/dashboard/HostActionsWidget';
import { MyUpcomingGamesCarousel } from '@/components/dashboard/MyUpcomingGamesCarousel';
import { PlayersBucket } from '@/components/dashboard/PlayersBucket';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage
});

function DashboardPage() {
  const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
  const [selectedProfileId, setSelectedProfileId] = useState<Id<'userSportProfiles'> | null>(null);

  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      if (selectedProfileId !== null) {
        setSelectedProfileId(null);
      }
      return;
    }

    if (selectedProfileId && !profiles.some(profile => profile._id === selectedProfileId)) {
      setSelectedProfileId(null);
    }
  }, [profiles, selectedProfileId]);

  return (
    <div className="space-y-6 pb-12 sm:space-y-8">
      <DashboardHero selectedProfileId={selectedProfileId} onSelectedProfileChange={setSelectedProfileId} />
      <DashboardNotificationsWidget />

      <section className="border-border/70 bg-card/70 space-y-4 rounded-3xl border p-4 shadow-sm sm:p-6">
        <SectionHeader label="Top Matches" linkHref="/finder" linkLabel="Explore all in Finder" />
        <div className="grid gap-4 md:grid-cols-2">
          <PlayersBucket limit={5} hideSearch showTitle selectedProfileId={selectedProfileId} />
          <GamesBucket limit={5} hideSearch hideHostPanel showTitle selectedProfileId={selectedProfileId} />
        </div>
      </section>

      <section className="border-border/70 bg-card/70 space-y-4 rounded-3xl border p-4 shadow-sm sm:p-6">
        <SectionHeader label="My Upcoming Games" />
        <MyUpcomingGamesCarousel />
      </section>

      <HostActionsWidget />
    </div>
  );
}
