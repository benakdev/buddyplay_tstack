import { z } from "zod";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	decrementUnreadCount,
	incrementUnreadCount,
} from "./lib/notifications";
import { SKILL_RANGES } from "./lib/validation/sharedSchemas";
import { zInternalMutation, zMutation, zQuery, zid } from "./lib/zodHelpers";
import {
	sportProfileSchema,
	sportProfileUpdateArgsSchema,
	sportProfileUpsertSchema,
} from "./lib/zodSchemas";
import { requireUser } from "./users";

/**
 * Validate skill level is within acceptable range for the sport.
 */
const PLAYTOMIC_MAX = 7;
const WPR_MAX = 21;
const MEN_WPR_CAP = 16;
const WOMEN_WPR_CAP = 12;
const MEN_PLAYTOMIC_MULTIPLIER = 2.286;
const WOMEN_PLAYTOMIC_MULTIPLIER = 1.714;

const padelRatingsSchema = z
	.object({
		playtomicRating: z.number().min(0).max(PLAYTOMIC_MAX).optional(),
		wprRating: z.number().min(0).max(WPR_MAX).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.playtomicRating === undefined && data.wprRating === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "At least one rating (Playtomic or WPR) is required.",
				path: ["playtomicRating"],
			});
		}
	});

const derivedSkillLevelSchema = z
	.number()
	.optional()
	.refine((value) => value !== undefined, {
		message: "Skill level is required.",
	})
	.transform((value) => value as number);

const pickleballSkillSchema = z
	.number()
	.min(SKILL_RANGES.Pickleball.min)
	.max(SKILL_RANGES.Pickleball.max);

const sportSkillInputSchema = z.discriminatedUnion("sport", [
	z.object({
		sport: z.literal("Padel"),
		playtomicRating: z.number().optional(),
		wprRating: z.number().optional(),
		skillLevel: z.number().optional(),
	}),
	z.object({
		sport: z.literal("Pickleball"),
		skillLevel: pickleballSkillSchema,
		playtomicRating: z.number().optional(),
		wprRating: z.number().optional(),
	}),
]);

function getWprCapForGender(gender?: string): number {
	return gender === "Female" ? WOMEN_WPR_CAP : MEN_WPR_CAP;
}

function getPlaytomicMultiplierForGender(gender?: string): number {
	return gender === "Female"
		? WOMEN_PLAYTOMIC_MULTIPLIER
		: MEN_PLAYTOMIC_MULTIPLIER;
}

function requireProfileGender(gender?: string): void {
	if (!gender) {
		throw new Error(
			"Please complete your profile (set your gender) before creating a Sport Passport.",
		);
	}
}

function normalizeToWprEquivalent(
	playtomicRating: number | undefined,
	wprRating: number | undefined,
	gender?: string,
): number | null {
	if (wprRating !== undefined) {
		return wprRating;
	}

	if (playtomicRating !== undefined) {
		return playtomicRating * getPlaytomicMultiplierForGender(gender);
	}

	return null;
}

function derivePlaytomicFromWpr(wprRating: number, gender?: string): number {
	return wprRating / getPlaytomicMultiplierForGender(gender);
}

function getPadelTier(
	wprRating: number | undefined,
	gender?: string,
): "amateur" | "pro" | null {
	if (wprRating === undefined) return "amateur";
	return wprRating > getWprCapForGender(gender) ? "pro" : "amateur";
}

function getAvailabilityOverlapCount(
	availabilityA:
		| Record<string, Record<string, boolean> | undefined>
		| undefined,
	availabilityB:
		| Record<string, Record<string, boolean> | undefined>
		| undefined,
): number {
	if (!availabilityA || !availabilityB) return 0;

	const days = Object.keys(availabilityA) as Array<keyof typeof availabilityA>;
	let overlap = 0;

	for (const day of days) {
		const slotsA = availabilityA[day];
		const slotsB = availabilityB[day];
		if (!slotsA || !slotsB) continue;

		for (const slotKey of Object.keys(slotsA)) {
			if (slotsA[slotKey] && slotsB[slotKey]) {
				overlap += 1;
			}
		}
	}

	return overlap;
}

function genderMatchesPreference(
	preferredGender: string | undefined,
	gender: string | undefined,
): boolean {
	if (!preferredGender || preferredGender === "Any") return true;
	return gender === preferredGender;
}

/**
 * Validate Padel-specific ratings.
 * Throws descriptive errors if ratings are out of range or missing.
 */
function validatePadelRatings(
	playtomicRating?: number,
	wprRating?: number,
): void {
	padelRatingsSchema.parse({ playtomicRating, wprRating });
}

/**
 * Derive a canonical skillLevel from Padel ratings or direct skillLevel.
 * For Padel: uses playtomicRating directly, or derives from WPR.
 * For Pickleball: uses the provided skillLevel.
 */
function deriveSkillLevel(
	sport: "Padel" | "Pickleball",
	args: { skillLevel?: number; playtomicRating?: number; wprRating?: number },
	gender?: string,
	fallbackSkillLevel?: number,
): number {
	const skillLevelForParse =
		sport === "Pickleball"
			? (args.skillLevel ?? fallbackSkillLevel)
			: args.skillLevel;
	sportSkillInputSchema.parse({
		sport,
		...args,
		skillLevel: skillLevelForParse,
	});

	const pickleballSkillLevel = args.skillLevel ?? fallbackSkillLevel;
	const derived =
		sport === "Padel"
			? (args.playtomicRating ??
				(args.wprRating !== undefined
					? derivePlaytomicFromWpr(args.wprRating, gender)
					: undefined))
			: pickleballSkillLevel;

	return derivedSkillLevelSchema.parse(derived);
}

const sportProfileCreateSchema = sportProfileUpsertSchema.extend({
	isActive: sportProfileUpsertSchema.shape.isActive.optional(),
});

/**
 * Create or update a sport profile for the current user.
 * Each user can have one profile per sport.
 */
export const upsertSportProfile = zMutation({
	args: sportProfileUpsertSchema,
	returns: zid("userSportProfiles"),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const user = await ctx.db.get("users", userId);

		const isPadel = args.sport === "Padel";

		requireProfileGender(user?.gender);

		if (!args.homeClubId) {
			throw new Error("Home club is required.");
		}

		if (isPadel) {
			validatePadelRatings(args.playtomicRating, args.wprRating);
		}

		const derivedSkillLevel = deriveSkillLevel(args.sport, args, user?.gender);

		// Check if profile already exists for this sport
		const existingProfile = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_user_sport", (q) =>
				q.eq("userId", userId).eq("sport", args.sport),
			)
			.unique();

		const now = Date.now();

		const profileData = {
			userId,
			sport: args.sport,
			isActive: args.isActive,
			skillLevel: derivedSkillLevel,
			homeClubId: args.homeClubId,
			playtomicRating: isPadel ? args.playtomicRating : undefined,
			wprRating: isPadel ? args.wprRating : undefined,
			matchingTolerance: args.matchingTolerance ?? 0.2,
			attributes: args.attributes,
			preferredGender: args.preferredGender ?? "Any",
			availability: args.availability,
			updatedAt: now,
		};

		if (existingProfile) {
			await ctx.db.patch("userSportProfiles", existingProfile._id, profileData);
			return existingProfile._id;
		}

		const profileId = await ctx.db.insert("userSportProfiles", profileData);
		await ctx.scheduler.runAfter(0, api.alerts.syncPassportAlert, {
			profileId,
		});
		await ctx.scheduler.runAfter(
			0,
			internal.sportProfiles.notifyMatchingUsers,
			{ profileId },
		);
		return profileId;
	},
});

/**
 * Create a new sport profile for the current user.
 * Will error if profile already exists for this sport.
 */
export const createSportProfile = zMutation({
	args: sportProfileCreateSchema,
	returns: zid("userSportProfiles"),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const user = await ctx.db.get("users", userId);

		const isPadel = args.sport === "Padel";

		requireProfileGender(user?.gender);

		if (!args.homeClubId) {
			throw new Error("Home club is required.");
		}

		if (isPadel) {
			validatePadelRatings(args.playtomicRating, args.wprRating);
		}

		const derivedSkillLevel = deriveSkillLevel(args.sport, args, user?.gender);

		// Check if profile already exists for this sport
		const existingProfile = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_user_sport", (q) =>
				q.eq("userId", userId).eq("sport", args.sport),
			)
			.unique();

		if (existingProfile) {
			throw new Error(
				`You already have a profile for ${args.sport}. Use update instead.`,
			);
		}

		const profileId = await ctx.db.insert("userSportProfiles", {
			userId,
			sport: args.sport,
			isActive: args.isActive ?? true,
			skillLevel: derivedSkillLevel,
			homeClubId: args.homeClubId,
			playtomicRating: isPadel ? args.playtomicRating : undefined,
			wprRating: isPadel ? args.wprRating : undefined,
			matchingTolerance: args.matchingTolerance ?? 0.2,
			attributes: args.attributes,
			preferredGender: args.preferredGender ?? "Any",
			availability: args.availability,
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, api.alerts.syncPassportAlert, {
			profileId,
		});
		await ctx.scheduler.runAfter(
			0,
			internal.sportProfiles.notifyMatchingUsers,
			{ profileId },
		);

		return profileId;
	},
});

/**
 * Get all sport profiles for the current user.
 */
export const getCurrentUserProfiles = zQuery({
	args: {},
	returns: z.array(sportProfileSchema),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return [];
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!user) {
			return [];
		}

		const profiles = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_user_id", (q) => q.eq("userId", user._id))
			.collect();

		return profiles;
	},
});

/**
 * Get all sport profiles for a specific user.
 * Note: Intentionally public - no auth check required as user profiles are public.
 */
export const getUserProfiles = zQuery({
	args: {
		userId: zid("users"),
	},
	returns: z.array(sportProfileSchema),
	handler: async (ctx, args) => {
		const profiles = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_user_id", (q) => q.eq("userId", args.userId))
			.collect();

		return profiles;
	},
});

/**
 * Get a specific sport profile by ID.
 */
export const getSportProfile = zQuery({
	args: {
		profileId: zid("userSportProfiles"),
	},
	returns: sportProfileSchema.nullable(),
	handler: async (ctx, args) => {
		return await ctx.db.get("userSportProfiles", args.profileId);
	},
});

/**
 * Update an existing sport profile.
 */
export const updateSportProfile = zMutation({
	args: sportProfileUpdateArgsSchema,
	returns: z.null(),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const user = await ctx.db.get("users", userId);

		const profile = await ctx.db.get("userSportProfiles", args.profileId);
		if (!profile) {
			throw new Error("Profile not found");
		}

		if (profile.userId !== userId) {
			throw new Error("Not authorized to update this profile");
		}

		// Validate Padel ratings if any are being updated
		const nextPlaytomicRating = args.playtomicRating ?? profile.playtomicRating;
		const nextWprRating = args.wprRating ?? profile.wprRating;

		if (profile.sport === "Padel") {
			if (args.wprRating !== undefined && !user?.gender) {
				throw new Error("Please set your gender before adding a WPR rating.");
			}
			validatePadelRatings(nextPlaytomicRating, nextWprRating);
		}

		const derivedSkillLevel = deriveSkillLevel(
			profile.sport,
			{
				playtomicRating: nextPlaytomicRating,
				wprRating: nextWprRating,
				skillLevel: args.skillLevel,
			},
			user?.gender,
			profile.skillLevel,
		);

		const updates: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.isActive !== undefined) updates.isActive = args.isActive;
		if (profile.sport === "Pickleball" && args.skillLevel !== undefined)
			updates.skillLevel = args.skillLevel;
		if (
			profile.sport === "Padel" &&
			(args.playtomicRating !== undefined || args.wprRating !== undefined)
		) {
			updates.skillLevel = derivedSkillLevel;
		}
		if (args.homeClubId !== undefined) updates.homeClubId = args.homeClubId;
		if (profile.sport === "Padel" && args.playtomicRating !== undefined)
			updates.playtomicRating = args.playtomicRating;
		if (profile.sport === "Padel" && args.wprRating !== undefined)
			updates.wprRating = args.wprRating;
		if (args.matchingTolerance !== undefined)
			updates.matchingTolerance = args.matchingTolerance;
		if (args.attributes !== undefined) updates.attributes = args.attributes;
		if (args.preferredGender !== undefined)
			updates.preferredGender = args.preferredGender;
		if (args.availability !== undefined)
			updates.availability = args.availability;

		await ctx.db.patch("userSportProfiles", args.profileId, updates);
		await ctx.scheduler.runAfter(0, api.alerts.syncPassportAlert, {
			profileId: args.profileId,
		});
		await ctx.scheduler.runAfter(
			0,
			internal.sportProfiles.notifyMatchingUsers,
			{ profileId: args.profileId },
		);
		return null;
	},
});

/**
 * Delete a sport profile.
 */
export const deleteSportProfile = zMutation({
	args: {
		profileId: zid("userSportProfiles"),
	},
	returns: z.null(),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);

		const profile = await ctx.db.get("userSportProfiles", args.profileId);
		if (!profile) {
			throw new Error("Profile not found");
		}

		if (profile.userId !== userId) {
			throw new Error("Not authorized to delete this profile");
		}

		await ctx.db.delete("userSportProfiles", args.profileId);

		// Delete the associated passport alert
		const passportAlert = await ctx.db
			.query("alerts")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("isPassport"), true))
			.filter((q) => q.eq(q.field("sport"), profile.sport))
			.unique();

		if (passportAlert) {
			await ctx.db.delete("alerts", passportAlert._id);
		}

		const notificationsByProfile = await ctx.db
			.query("notifications")
			.withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
			.collect();

		const notificationsByMatch = await ctx.db
			.query("notifications")
			.withIndex("by_matching_profile", (q) =>
				q.eq("matchingProfileId", args.profileId),
			)
			.collect();

		const notificationsToRemove = new Map<
			string,
			(typeof notificationsByProfile)[number]
		>();
		for (const notification of notificationsByProfile) {
			notificationsToRemove.set(notification._id, notification);
		}
		for (const notification of notificationsByMatch) {
			notificationsToRemove.set(notification._id, notification);
		}

		for (const notification of notificationsToRemove.values()) {
			if (notification.type !== "PLAYER_MATCH") {
				continue;
			}
			if (notification.matchStatus === "REMOVED") {
				continue;
			}

			await ctx.db.patch("notifications", notification._id, {
				matchStatus: "REMOVED",
			});
			if (!notification.read) {
				await decrementUnreadCount(ctx, notification.userId);
			}
		}
		return null;
	},
});

/**
 * Find matching players based on sport, skill level, and preferences.
 * Uses ±tolerance matching for skill levels.
 */
export const findMatchingPlayers = zQuery({
	args: {
		profileId: zid("userSportProfiles"),
		tolerance: z.number().optional(), // Default 0.2 (±20%)
		limit: z.number().optional(),
	},
	returns: z.array(
		z.object({
			profile: sportProfileSchema,
			user: z.object({
				_id: zid("users"),
				username: z.string(),
			}),
			score: z.number(),
		}),
	),
	handler: async (ctx, args) => {
		const currentUserId = await requireUser(ctx);
		const currentUser = await ctx.db.get("users", currentUserId);

		const limit = args.limit ?? 20;
		const tolerance = args.tolerance ?? 0.2;

		const currentProfile = await ctx.db.get(
			"userSportProfiles",
			args.profileId,
		);
		if (!currentProfile) {
			throw new Error("Profile not found");
		}

		if (currentProfile.userId !== currentUserId) {
			throw new Error("Not authorized to match with this profile");
		}

		// Get active profiles for the sport
		const profiles = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_sport_active_level", (q) =>
				q.eq("sport", currentProfile.sport).eq("isActive", true),
			)
			.collect();

		// Enrich with user data, excluding current user
		const results: Array<{
			profile: (typeof profiles)[number];
			user: { _id: (typeof profiles)[number]["userId"]; username: string };
			score: number;
		}> = [];

		for (const profile of profiles) {
			// Skip current user
			if (profile.userId === currentUserId) {
				continue;
			}

			const user = await ctx.db.get("users", profile.userId);
			if (!user) {
				continue;
			}

			// Gender preference matching (both ways)
			const currentUserGender = currentUser?.gender;
			const candidateGender = user.gender;

			if (
				!genderMatchesPreference(
					currentProfile.preferredGender,
					candidateGender,
				)
			) {
				continue;
			}

			if (
				!genderMatchesPreference(profile.preferredGender, currentUserGender)
			) {
				continue;
			}

			let currentRating: number | null = null;
			let candidateRating: number | null = null;
			let isRatingMatch = false;

			if (currentProfile.sport === "Padel") {
				const currentTier = getPadelTier(
					currentProfile.wprRating,
					currentUserGender,
				);
				const candidateTier = getPadelTier(profile.wprRating, candidateGender);

				if (currentTier === "pro" || candidateTier === "pro") {
					if (currentTier !== candidateTier) {
						continue;
					}
				}

				currentRating = normalizeToWprEquivalent(
					currentProfile.playtomicRating,
					currentProfile.wprRating,
					currentUserGender,
				);
				candidateRating = normalizeToWprEquivalent(
					profile.playtomicRating,
					profile.wprRating,
					candidateGender,
				);

				if (
					currentRating !== null &&
					candidateRating !== null &&
					currentRating > 0
				) {
					const toleranceRange = currentRating * tolerance;
					const minLevel = currentRating - toleranceRange;
					const maxLevel = currentRating + toleranceRange;
					isRatingMatch =
						candidateRating >= minLevel && candidateRating <= maxLevel;
				}
			} else {
				if (
					currentProfile.skillLevel !== undefined &&
					profile.skillLevel !== undefined
				) {
					const toleranceRange = currentProfile.skillLevel * tolerance;
					const minLevel = currentProfile.skillLevel - toleranceRange;
					const maxLevel = currentProfile.skillLevel + toleranceRange;
					isRatingMatch =
						profile.skillLevel >= minLevel && profile.skillLevel <= maxLevel;

					currentRating = currentProfile.skillLevel;
					candidateRating = profile.skillLevel;
				}
			}

			if (!isRatingMatch) {
				continue;
			}

			const clubScore =
				currentProfile.homeClubId &&
				profile.homeClubId &&
				currentProfile.homeClubId === profile.homeClubId
					? 100
					: 0;
			const ratingScore =
				currentRating && candidateRating
					? Math.max(
							0,
							100 -
								Math.abs(currentRating - candidateRating) *
									(100 / currentRating),
						)
					: 0;
			const availabilityScore =
				getAvailabilityOverlapCount(
					currentProfile.availability,
					profile.availability,
				) * 10;

			const score = clubScore + ratingScore + availabilityScore;

			results.push({
				profile,
				user: {
					_id: user._id,
					username: user.username,
				},
				score,
			});
		}

		results.sort((a, b) => b.score - a.score);

		return results.slice(0, limit);
	},
});

/**
 * Notify other users when a sport profile is created or updated.
 * Matches users based on:
 * 1. Same Club
 * 2. Similar Skill Level (within 20%)
 */
export const notifyMatchingUsers = zInternalMutation({
	args: {
		profileId: zid("userSportProfiles"),
	},
	returns: z.null(),
	handler: async (ctx, { profileId }) => {
		// 1. Get the profile (Bob)
		const profile = await ctx.db.get("userSportProfiles", profileId);
		if (!profile) return null;

		const existingNotifications = await ctx.db
			.query("notifications")
			.withIndex("by_profile", (q) => q.eq("profileId", profile._id))
			.collect();

		const existingMatchNotifications = existingNotifications.filter(
			(notification) => notification.type === "PLAYER_MATCH",
		);
		const existingByKey = new Map<
			string,
			(typeof existingMatchNotifications)[number]
		>();

		for (const notification of existingMatchNotifications) {
			if (!notification.matchingProfileId) {
				continue;
			}
			const key = `${notification.userId}:${notification.matchingProfileId}`;
			existingByKey.set(key, notification);
		}

		const invalidateAllMatches = async (): Promise<void> => {
			for (const notification of existingMatchNotifications) {
				if (notification.matchStatus === "REMOVED") {
					continue;
				}
				if (notification.matchStatus !== "INVALID") {
					await ctx.db.patch("notifications", notification._id, {
						matchStatus: "INVALID",
					});
					if (!notification.read) {
						await decrementUnreadCount(ctx, notification.userId);
					}
				}
			}
		};

		// 2. Initial Checks
		if (
			!profile.isActive ||
			!profile.homeClubId ||
			profile.skillLevel === undefined
		) {
			await invalidateAllMatches();
			return null;
		}

		// 3. Query potential matches (Same Sport + Active)
		console.log(
			`[PlayerMatch] Processing profile ${profile._id} (${profile.userId}) - Sport: ${profile.sport}, Club: ${profile.homeClubId}, Level: ${profile.skillLevel}`,
		);

		const candidates = await ctx.db
			.query("userSportProfiles")
			.withIndex("by_sport_active_level", (q) =>
				q.eq("sport", profile.sport).eq("isActive", true),
			)
			.collect();

		console.log(
			`[PlayerMatch] Found ${candidates.length} active candidates for ${profile.sport}`,
		);

		const userIds = Array.from(
			new Set([
				profile.userId,
				...candidates.map((candidate) => candidate.userId),
			]),
		);
		const users = await Promise.all(
			userIds.map((userId) => ctx.db.get("users", userId)),
		);
		const userById = new Map(
			users.filter(Boolean).map((userDoc) => [userDoc!._id, userDoc!]),
		);

		const clubIds = Array.from(
			new Set(
				[
					profile.homeClubId,
					...candidates.map((candidate) => candidate.homeClubId),
				].filter((clubId): clubId is Id<"clubs"> => clubId !== undefined),
			),
		);
		const clubs = await Promise.all(
			clubIds.map((clubId) => ctx.db.get("clubs", clubId)),
		);
		const clubById = new Map(
			clubs.filter(Boolean).map((club) => [club!._id, club!]),
		);

		const matchedProfileIds = new Set<string>();
		const upsertMatchNotification = async (args: {
			userId: Id<"users">;
			matchingProfileId: Id<"userSportProfiles">;
			title: string;
			body: string;
			data: Record<string, unknown>;
		}): Promise<void> => {
			const key = `${args.userId}:${args.matchingProfileId}`;
			const existing = existingByKey.get(key);

			if (existing) {
				await ctx.db.patch("notifications", existing._id, {
					title: args.title,
					body: args.body,
					data: args.data,
					matchStatus: "ACTIVE",
				});
				return;
			}

			await ctx.db.insert("notifications", {
				userId: args.userId,
				type: "PLAYER_MATCH",
				title: args.title,
				body: args.body,
				read: false,
				profileId: profile._id,
				matchingProfileId: args.matchingProfileId,
				matchStatus: "ACTIVE",
				data: args.data,
			});

			await incrementUnreadCount(ctx, args.userId);
		};

		// 4. Filter Candidates
		for (const candidate of candidates) {
			// Exclude self
			if (candidate.userId === profile.userId) {
				continue;
			}

			// Must be same club
			if (candidate.homeClubId !== profile.homeClubId) {
				console.log(
					`[PlayerMatch] Excluding candidate ${candidate.userId}: Club mismatch (${candidate.homeClubId} vs ${profile.homeClubId})`,
				);
				continue;
			}

			// Check reciprocity of Skill Level (20% logic)
			const pLevel = profile.skillLevel;
			const cLevel = candidate.skillLevel;

			if (pLevel === undefined || cLevel === undefined) {
				console.log(
					`[PlayerMatch] Excluding candidate ${candidate.userId}: Undefined level (P:${pLevel}, C:${cLevel})`,
				);
				continue;
			}

			const pTolerance = pLevel * (profile.matchingTolerance ?? 0.2);
			const cTolerance = cLevel * (candidate.matchingTolerance ?? 0.2);

			const matchesP =
				cLevel >= pLevel - pTolerance && cLevel <= pLevel + pTolerance;
			const matchesC =
				pLevel >= cLevel - cTolerance && pLevel <= cLevel + cTolerance;

			console.log(
				`[PlayerMatch] Checking candidate ${candidate.userId}: Levels P:${pLevel} vs C:${cLevel}. Match P->C? ${matchesP}, C->P? ${matchesC}`,
			);

			if (matchesP && matchesC) {
				// MATCH FOUND!
				console.log(
					`[PlayerMatch] Match found! Creating bidirectional notifications for ${candidate.userId} and ${profile.userId}`,
				);

				const profileUser = userById.get(profile.userId);
				const candidateUser = userById.get(candidate.userId);
				const profileHandle = profileUser?.username
					? `@${profileUser.username}`
					: "A player";
				const candidateHandle = candidateUser?.username
					? `@${candidateUser.username}`
					: "A player";
				const profileClubName = profile.homeClubId
					? clubById.get(profile.homeClubId)?.name
					: undefined;
				const candidateClubName = candidate.homeClubId
					? clubById.get(candidate.homeClubId)?.name
					: undefined;
				const profileClubText = profileClubName
					? `at ${profileClubName}`
					: "at your club";
				const candidateClubText = candidateClubName
					? `at ${candidateClubName}`
					: "at your club";

				matchedProfileIds.add(candidate._id);

				// 1. Notify the Candidate (B) about Profile (A)
				await upsertMatchNotification({
					userId: candidate.userId,
					matchingProfileId: candidate._id,
					title: "New Player Match!",
					body: `${profileHandle} (${pLevel.toFixed(1)} ${profile.sport}) ${profileClubText} matches your skill.`,
					data: {
						matchingProfileId: profile._id,
						matchingUserId: profile.userId,
						actorUserId: profile.userId,
						actorUsername: profileUser?.username,
					},
				});

				// 2. Notify the Profile Owner (A) about Candidate (B)
				await upsertMatchNotification({
					userId: profile.userId,
					matchingProfileId: candidate._id,
					title: "New Player Match!",
					body: `${candidateHandle} (${cLevel.toFixed(1)} ${candidate.sport}) ${candidateClubText} matches your skill.`,
					data: {
						matchingProfileId: candidate._id,
						matchingUserId: candidate.userId,
						actorUserId: candidate.userId,
						actorUsername: candidateUser?.username,
					},
				});
			}
		}

		for (const notification of existingMatchNotifications) {
			if (!notification.matchingProfileId) {
				continue;
			}
			if (notification.matchStatus === "REMOVED") {
				continue;
			}
			if (!matchedProfileIds.has(notification.matchingProfileId)) {
				if (notification.matchStatus !== "INVALID") {
					await ctx.db.patch("notifications", notification._id, {
						matchStatus: "INVALID",
					});
					if (!notification.read) {
						await decrementUnreadCount(ctx, notification.userId);
					}
				}
			}
		}
		return null;
	},
});
