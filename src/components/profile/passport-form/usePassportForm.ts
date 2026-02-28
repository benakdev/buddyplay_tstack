"use client";

import * as React from "react";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SKILL_RANGES } from "@/convex/lib/validation/sharedSchemas";
import {
	type PassportFormValues,
	createPassportFormSchema,
} from "@/lib/schema/passportForm";
import type { Sport } from "@/lib/schema/types";

interface UsePassportFormOptions {
	sport: Sport;
	mode: "create" | "edit";
	profileId?: Id<"userSportProfiles">;
	initialData?: Partial<PassportFormValues>;
	onSuccess: () => void;
}

export function usePassportForm({
	sport,
	mode,
	profileId,
	initialData,
	onSuccess,
}: UsePassportFormOptions) {
	const skillRange = SKILL_RANGES[sport];
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [deleteAlertOpen, setDeleteAlertOpen] = React.useState(false);

	const upsert = useMutation(api.sportProfiles.upsertSportProfile);
	const update = useMutation(api.sportProfiles.updateSportProfile);
	const deleteProfile = useMutation(api.sportProfiles.deleteSportProfile);
	const currentUser = useQuery(api.users.getCurrentUser, {});

	const wprCap = currentUser?.gender === "Female" ? 12 : 16;

	const formSchema = React.useMemo(
		() => createPassportFormSchema(sport),
		[sport],
	);

	const form = useForm({
		defaultValues: {
			skillLevel:
				initialData?.skillLevel ??
				(sport === "Pickleball" ? skillRange.min : undefined),
			homeClubId: initialData?.homeClubId ?? "",
			// For new Padel passports, default playtomicRating to minimum so validation passes
			// (schema requires at least one rating for Padel)
			playtomicRating:
				initialData?.playtomicRating ??
				(sport === "Padel" ? skillRange.min : undefined),
			wprRating: initialData?.wprRating,
			hand: initialData?.hand ?? "Right",
			courtSide: initialData?.courtSide ?? "Left",
			preferredGender: initialData?.preferredGender ?? "Any",
			availability: initialData?.availability ?? {},
		} as PassportFormValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value }) => {
			// Validate before entering submit state
			if (
				sport === "Padel" &&
				value.wprRating !== undefined &&
				!currentUser?.gender
			) {
				toast.error("Please set your gender before adding a WPR rating.");
				return;
			}

			if (mode === "edit" && !profileId) {
				toast.error("Cannot update: profile ID is missing.");
				return;
			}

			const homeClubId = value.homeClubId as Id<"clubs"> | undefined;
			if (!homeClubId) {
				toast.error("Home club is required.");
				return;
			}

			setIsSubmitting(true);
			try {
				const sharedPayload = {
					skillLevel: sport === "Pickleball" ? value.skillLevel : undefined,
					homeClubId,
					playtomicRating:
						sport === "Padel" ? value.playtomicRating : undefined,
					wprRating: sport === "Padel" ? value.wprRating : undefined,
					attributes: {
						hand: value.hand,
						courtSide: sport === "Padel" ? value.courtSide : undefined,
					},
					preferredGender: value.preferredGender,
					availability: value.availability,
				};

				if (mode === "create") {
					await upsert({ sport, isActive: true, ...sharedPayload });
				} else {
					await update({ profileId: profileId!, ...sharedPayload });
				}
				onSuccess();
			} catch (error) {
				toast.error("Failed to save passport. Please try again.");
				console.error(error);
			} finally {
				setIsSubmitting(false);
			}
		},
	});

	const handleDelete = async () => {
		if (!profileId) return;

		setIsSubmitting(true);
		try {
			await deleteProfile({ profileId });
			onSuccess();
		} catch (error) {
			toast.error(
				"Failed to delete passport, please try again or contact support.",
			);
			console.error(error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		form,
		isSubmitting,
		deleteAlertOpen,
		setDeleteAlertOpen,
		handleDelete,
		skillRange,
		wprCap,
	};
}

// Export the form type for use in child components
export type PassportForm = ReturnType<typeof usePassportForm>["form"];
