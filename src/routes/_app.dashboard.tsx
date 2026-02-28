import { createFileRoute } from "@tanstack/react-router";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardNotificationsWidget } from "@/components/dashboard/DashboardNotificationsWidget";
import { GamesBucket } from "@/components/dashboard/GamesBucket";
import { HostActionsWidget } from "@/components/dashboard/HostActionsWidget";
import { MyUpcomingGamesCarousel } from "@/components/dashboard/MyUpcomingGamesCarousel";
import { PlayersBucket } from "@/components/dashboard/PlayersBucket";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

export const Route = createFileRoute("/_app/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<div className="space-y-8 pb-12">
			<DashboardHero />
			<DashboardNotificationsWidget />

			<section className="space-y-4">
				<SectionHeader
					label="Top Matches"
					linkHref="/finder"
					linkLabel="Explore all in Finder"
				/>
				<div className="grid gap-4 md:grid-cols-2">
					<PlayersBucket limit={5} hideSearch showTitle />
					<GamesBucket limit={5} hideSearch hideHostPanel showTitle />
				</div>
			</section>

			<section className="space-y-4">
				<SectionHeader label="My Upcoming Games" />
				<MyUpcomingGamesCarousel />
			</section>

			<HostActionsWidget />
		</div>
	);
}
