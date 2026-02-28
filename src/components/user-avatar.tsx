"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
	tokenIdentifier: string;
	username: string;
	className?: string;
	fallbackClassName?: string;
}

const avatarMemoryCache = new Map<string, string | null>();

/**
 * Avatar that fetches its image from Clerk based on the user's token identifier.
 * Caches the result in session storage to avoid spamming the server action.
 */
export function UserAvatar({
	tokenIdentifier,
	username,
	className,
	fallbackClassName,
}: UserAvatarProps) {
	const [imageUrl, setImageUrl] = React.useState<string | null>(null);
	const initials = username.charAt(0).toUpperCase();

	React.useEffect(() => {
		let cancelled = false;

		if (!tokenIdentifier) {
			setImageUrl(null);
			return;
		}

		// Check cache first
		const cacheKey = `avatar_${tokenIdentifier}`;

		if (avatarMemoryCache.has(tokenIdentifier)) {
			setImageUrl(avatarMemoryCache.get(tokenIdentifier) ?? null);
			return;
		}

		const cached = sessionStorage.getItem(cacheKey);
		if (cached) {
			avatarMemoryCache.set(tokenIdentifier, cached);
			setImageUrl(cached);
			return;
		}

		setImageUrl(null);

		avatarMemoryCache.set(tokenIdentifier, null);

		if (!cancelled) {
			setImageUrl(null);
		}

		return () => {
			cancelled = true;
		};
	}, [tokenIdentifier]);

	return (
		<Avatar className={cn("size-8 shrink-0", className)}>
			<AvatarImage src={imageUrl || undefined} alt={username} />
			<AvatarFallback
				className={cn(
					"bg-muted text-muted-foreground text-xs",
					fallbackClassName,
				)}
			>
				{initials}
			</AvatarFallback>
		</Avatar>
	);
}
