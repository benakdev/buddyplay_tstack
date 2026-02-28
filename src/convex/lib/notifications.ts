import type { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

/**
 * Increment the unread notification count for a user.
 * Used when creating new notifications to keep the count in sync.
 *
 * @param ctx - The mutation context
 * @param userId - The user ID to increment the count for
 */
export async function incrementUnreadCount(
	ctx: MutationCtx,
	userId: Id<"users">,
): Promise<void> {
	const user = await ctx.db.get("users", userId);
	if (user) {
		const currentCount = user.unreadNotificationCount ?? 0;
		await ctx.db.patch("users", userId, {
			unreadNotificationCount: currentCount + 1,
		});
	}
}

/**
 * Decrement the unread notification count for a user.
 * Used when marking notifications as read or deleting unread notifications.
 * Ensures count never goes below 0.
 *
 * @param ctx - The mutation context
 * @param userId - The user ID to decrement the count for
 */
export async function decrementUnreadCount(
	ctx: MutationCtx,
	userId: Id<"users">,
): Promise<void> {
	const user = await ctx.db.get("users", userId);
	if (user) {
		const currentCount = user.unreadNotificationCount ?? 0;
		await ctx.db.patch("users", userId, {
			unreadNotificationCount: Math.max(0, currentCount - 1),
		});
	}
}

/**
 * Reset the unread notification count for a user to zero.
 * Used when marking all notifications as read.
 *
 * @param ctx - The mutation context
 * @param userId - The user ID to reset the count for
 */
export async function resetUnreadCount(
	ctx: MutationCtx,
	userId: Id<"users">,
): Promise<void> {
	const user = await ctx.db.get("users", userId);
	if (user) {
		await ctx.db.patch("users", userId, { unreadNotificationCount: 0 });
	}
}
