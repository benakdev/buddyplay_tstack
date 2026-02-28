import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { useQuery } from "convex/react";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { SportPassportGrid } from "@/components/profile/SportPassportGrid";
import { api } from "@/convex/_generated/api";

export const Route = createFileRoute("/_app/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const convexUser = useQuery(api.users.getCurrentUser);
	const isUserLoading = convexUser === undefined;
	const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

	return (
		<div className="container max-w-5xl space-y-12 py-12">
			<ProfileHero
				user={convexUser ?? null}
				isUserLoading={isUserLoading}
				profileSettingsOpen={profileSettingsOpen}
				onProfileSettingsOpenChange={setProfileSettingsOpen}
			/>
			<SportPassportGrid
				onRequireProfileSetup={() => setProfileSettingsOpen(true)}
			/>
		</div>
	);
}
