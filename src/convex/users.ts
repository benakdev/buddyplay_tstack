import { z } from "zod";

import type { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { zMutation, zQuery, zid } from "./lib/zodHelpers";
import { userSchema, userUpdateSchema } from "./lib/zodSchemas";

/**
 * Generate a unique username from a full name.
 * Format: firstname + first letter of lastname + random numbers
 * Example: "John Doe" → "johnd4523"
 */
async function generateUniqueUsername(
	ctx: MutationCtx,
	fullName: string,
): Promise<string> {
	// Parse name parts
	const nameParts = fullName.trim().split(/\s+/);
	const firstName = nameParts[0] || "user";
	const lastInitial =
		nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : "";

	// Create base username (lowercase)
	const baseUsername = (firstName + lastInitial)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

	// 1. Try with 6 random digits (1 million combinations)
	const randomSuffix = Math.floor(100000 + Math.random() * 900000); // 6-digit number
	const candidateUsername = baseUsername + randomSuffix;

	// Check if taken
	const existing = await ctx.db
		.query("users")
		.withIndex("by_username", (q) => q.eq("username", candidateUsername))
		.unique();

	if (!existing) {
		return candidateUsername;
	}

	// 2. Fallback: Use full timestamp to guarantee uniqueness
	// This only runs in the 0.0001% case of a collision
	return baseUsername + Date.now();
}

/**
 * Get or create a user from Clerk identity.
 * This implements lazy user creation - the first time a Clerk user
 * interacts with the app, we create their Convex user record.
 */
export const getOrCreateUser = zMutation({
	args: {},
	returns: userSchema,
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		// Check if user already exists
		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_token", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (existingUser) {
			return existingUser;
		}

		// Generate unique username from Google OAuth name
		const fullName = identity.name || identity.email || "User";
		const username = await generateUniqueUsername(ctx, fullName);

		// Create new user from Clerk identity
		const userId = await ctx.db.insert("users", {
			tokenIdentifier: identity.tokenIdentifier,
			username,
			gender: undefined,
			bio: undefined,
			location: undefined,
			unreadNotificationCount: 0,
			privacySettings: undefined,
		});

		const newUser = await ctx.db.get("users", userId);
		if (!newUser) {
			throw new Error("Failed to create user");
		}

		return newUser;
	},
});

/**
 * Get the current authenticated user.
 * Returns null if not authenticated or user doesn't exist.
 */
export const getCurrentUser = zQuery({
	args: {},
	returns: userSchema.nullable(),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		return user;
	},
});

/**
 * Get a user by their Convex ID.
 */
export const getUser = zQuery({
	args: {
		userId: zid("users"),
	},
	returns: userSchema.nullable(),
	handler: async (ctx, args) => {
		return await ctx.db.get("users", args.userId);
	},
});

/**
 * Update the current user's profile.
 */
export const updateUser = zMutation({
	args: userUpdateSchema.shape,
	returns: z.null(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!user) {
			throw new Error("User not found");
		}

		const updates: {
			username?: string;
			gender?: "Male" | "Female" | "Other" | "Prefer not to say";
			bio?: string;
			location?: {
				city: string;
				postalCode: string;
				address?: string;
			};
			privacySettings?: {
				hideLastName: boolean;
				hideName: boolean;
			};
		} = {};

		if (args.username !== undefined) {
			updates.username = args.username;
		}
		if (args.gender !== undefined) {
			updates.gender = args.gender;
		}
		if (args.bio !== undefined) {
			updates.bio = args.bio;
		}
		if (args.location !== undefined) {
			updates.location = args.location;
		}
		if (args.privacySettings !== undefined) {
			updates.privacySettings = args.privacySettings;
		}

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch("users", user._id, updates);
		}

		return null;
	},
});

/**
 * Internal helper to get userId from Clerk identity.
 * Throws if user doesn't exist.
 */
export async function requireUser(
	ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Not authenticated");
	}

	const user = await ctx.db
		.query("users")
		.withIndex("by_token", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();

	if (!user) {
		throw new Error("User not found. Please sign in first.");
	}

	return user._id;
}

/**
 * Get a user by their username.
 * Used for public profile pages.
 */
export const getUserByUsername = zQuery({
	args: {
		username: z.string(),
	},
	returns: userSchema.nullable(),
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", args.username))
			.unique();

		return user;
	},
});
