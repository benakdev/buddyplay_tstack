import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Bell, CalendarDays } from 'lucide-react';

import { AlertCard } from '@/components/alerts';
import { HostActionsWidget } from '@/components/dashboard/HostActionsWidget';
import { MyUpcomingGamesCarousel } from '@/components/dashboard/MyUpcomingGamesCarousel';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/convex/_generated/api';

export const Route = createFileRoute('/_app/my-games')({
  component: MyGamesPage
});

function MyGamesPage() {
  const alerts = useQuery(api.alerts.getMyAlerts);

  return (
    <div className="space-y-6 py-4 sm:space-y-8 sm:py-8">
      <div className="border-border/70 rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted)/0.45)_100%)] p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Games</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-6 sm:text-base">
            Manage your upcoming games, host requests, and game-related alerts in one place.
          </p>
        </div>
      </div>

      <section className="border-border/70 bg-card/70 space-y-4 rounded-3xl border p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-muted-foreground size-5" />
          <h2 className="text-xl font-semibold">Upcoming Games</h2>
        </div>
        <MyUpcomingGamesCarousel />
      </section>

      <HostActionsWidget />

      <section className="border-border/70 bg-card/70 space-y-4 rounded-3xl border p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Bell className="text-primary size-5" />
            Matching Alerts
          </h2>
          {alerts && alerts.length > 0 && (
            <span className="text-muted-foreground text-sm">{alerts.filter(alert => alert.active).length} active</span>
          )}
        </div>

        <div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
          {alerts === undefined ? (
            <>
              <Skeleton className="h-40 min-w-[280px] rounded-2xl" />
              <Skeleton className="h-40 min-w-[280px] rounded-2xl" />
            </>
          ) : alerts.length === 0 ? (
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell />
                </EmptyMedia>
                <EmptyTitle>No alerts yet</EmptyTitle>
                <EmptyDescription>Create a Sport Passport to automatically generate matching alerts.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            alerts.map(alert => <AlertCard key={alert._id} alert={alert} />)
          )}
        </div>
      </section>
    </div>
  );
}
