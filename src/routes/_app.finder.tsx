import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";

import { FinderGamesTab } from "@/components/finder/FinderGamesTab";
import { FinderPlayersTab } from "@/components/finder/FinderPlayersTab";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Sport } from "@/lib/schema/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/finder")({
	component: FinderPage,
});

function FinderPage() {
	const [search, setSearch] = React.useState("");
	const [activeTab, setActiveTab] = React.useState<"players" | "games">(
		"players",
	);

	const profiles = useQuery(api.sportProfiles.getCurrentUserProfiles, {});
	const [selectedSport, setSelectedSport] = React.useState<Sport | null>(null);

	React.useEffect(() => {
		if (profiles && profiles.length > 0 && !selectedSport) {
			setSelectedSport(profiles[0].sport as Sport);
		}
	}, [profiles, selectedSport]);

	const sportOptions: Sport[] = Array.from(
		new Set((profiles ?? []).map((p) => p.sport as Sport)),
	);

	return (
		<div className="space-y-6 pb-12">
			<section className="space-y-0.5">
				<h1 className="text-3xl font-bold tracking-tight">Finder</h1>
				<p className="text-muted-foreground text-sm">
					Discover players and games.{" "}
					<span className="text-muted-foreground/70">
						Use @username to search by handle.
					</span>
				</p>
			</section>

			<div className="relative">
				<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={
						activeTab === "players"
							? "Search players or @username…"
							: "Search games or host…"
					}
					className="h-11 rounded-xl pr-10 pl-10 text-sm"
				/>
				{search && (
					<button
						onClick={() => setSearch("")}
						className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
						aria-label="Clear search"
					>
						<X className="size-4" />
					</button>
				)}
			</div>

			{sportOptions.length > 1 && (
				<div className="flex gap-2">
					{sportOptions.map((sport) => (
						<button
							key={sport}
							onClick={() => setSelectedSport(sport)}
							className={cn(
								"rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
								selectedSport === sport
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{sport}
						</button>
					))}
				</div>
			)}

			<Tabs
				value={activeTab}
				onValueChange={(v) => {
					setActiveTab(v as "players" | "games");
					setSearch("");
				}}
				className="space-y-4"
			>
				<TabsList className="w-full">
					<TabsTrigger value="players" className="flex-1">
						Players
					</TabsTrigger>
					<TabsTrigger value="games" className="flex-1">
						Games
					</TabsTrigger>
				</TabsList>

				<TabsContent value="players">
					<FinderPlayersTab search={search} sport={selectedSport} />
				</TabsContent>

				<TabsContent value="games">
					<FinderGamesTab search={search} sport={selectedSport} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
