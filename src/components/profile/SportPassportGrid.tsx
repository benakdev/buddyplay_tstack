"use client";

import * as React from "react";

import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Sport } from "@/lib/schema/types";
import { cn } from "@/lib/utils";

import { AddPassportModal } from "./AddPassportModal";
import { SportPassportCard, type SportProfile } from "./SportPassportCard";

interface SportPassportGridProps {
	className?: string;
	userId?: Id<"users">;
	onRequireProfileSetup?: () => void;
}

/**
 * SportPassportGrid - Horizontal grid of sport passport cards.
 * Shows existing passports + "Add Passport" placeholder (if < 2 passports).
 */
export function SportPassportGrid({
	className,
	userId,
	onRequireProfileSetup,
}: SportPassportGridProps) {
	// If userId is provided, we are viewing another user (or ourself via public profile)
	// We fetch their profiles.
	const userProfiles = useQuery(
		api.sportProfiles.getUserProfiles,
		userId ? { userId } : "skip",
	);

	// If userId is NOT provided, we are in "dashboard mode" for the current user
	const currentUserProfiles = useQuery(
		api.sportProfiles.getCurrentUserProfiles,
		userId ? "skip" : {},
	);
	const currentUser = useQuery(api.users.getCurrentUser, userId ? "skip" : {});

	// Determine which data to use
	const sportProfiles = userId ? userProfiles : currentUserProfiles;

	const [addModalOpen, setAddModalOpen] = React.useState(false);

	const isLoading = sportProfiles === undefined;

	// Only allow adding if we are NOT viewing a specific userId (dashboard mode)
	const isViewMode = !!userId;

	// Get existing sports
	const existingSports = React.useMemo(() => {
		if (!sportProfiles) return [];
		return sportProfiles.map((p) => p.sport as Sport);
	}, [sportProfiles]);

	// Available sports to add (max 2: Padel, Pickleball)
	const availableSports = React.useMemo(() => {
		const allSports: Sport[] = ["Padel", "Pickleball"];
		return allSports.filter((s) => !existingSports.includes(s));
	}, [existingSports]);

	const canAddMore = !isViewMode && availableSports.length > 0;
	const isProfileReady = !!currentUser?.gender;

	const handleAddPassport = () => {
		if (currentUser === undefined) {
			toast("Loading your profile…");
			return;
		}
		if (!currentUser) {
			toast.error("Please sign in to create a Sport Passport.");
			return;
		}
		if (!isProfileReady) {
			toast.error(
				"Please complete your profile (set your gender) before creating a Sport Passport.",
			);
			onRequireProfileSetup?.();
			return;
		}
		setAddModalOpen(true);
	};

	return (
		<div className={cn("space-y-4", className)}>
			<h2 className="text-lg font-semibold">Sport Passports</h2>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{/* Existing passport cards */}
				{sportProfiles?.map((profile) => (
					<SportPassportCard
						key={profile._id}
						profile={profile as SportProfile}
						isEditable={!userId}
					/>
				))}

				{/* Add Passport placeholder */}
				{canAddMore && (
					<Card
						className={cn(
							"hover:border-primary/50 group cursor-pointer border-2 border-dashed transition-colors",
							"flex min-h-40 items-center justify-center",
						)}
						onClick={handleAddPassport}
					>
						<CardContent className="flex flex-col items-center gap-3 py-8">
							<div className="bg-muted group-hover:bg-primary/10 flex size-12 items-center justify-center rounded-full transition-colors">
								<Plus className="text-muted-foreground group-hover:text-primary size-6 transition-colors" />
							</div>
							<span className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
								Add Passport
							</span>
						</CardContent>
					</Card>
				)}

				{/* Loading skeletons */}
				{isLoading && (
					<>
						<Card className="bg-muted/50 min-h-40 animate-pulse" />
						<Card className="bg-muted/50 min-h-40 animate-pulse" />
					</>
				)}

				{/* Empty state for view mode */}
				{!isLoading && sportProfiles?.length === 0 && isViewMode && (
					<div className="text-muted-foreground col-span-full py-8 text-center">
						No sport passports found.
					</div>
				)}
			</div>

			{/* Add Passport Modal */}
			<AddPassportModal
				open={addModalOpen}
				onOpenChange={setAddModalOpen}
				availableSports={availableSports}
			/>
		</div>
	);
}
