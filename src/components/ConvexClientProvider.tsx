"use client";

import { type ReactNode, useMemo } from "react";

import { useAuth } from "@clerk/tanstack-react-start";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

export default function ConvexClientProvider({
	children,
}: {
	children: ReactNode;
}) {
	const convexUrl = import.meta.env.VITE_CONVEX_URL;
	const convex = useMemo(() => {
		if (!convexUrl) {
			return null;
		}

		return new ConvexReactClient(convexUrl);
	}, [convexUrl]);

	if (!convex) {
		return <>{children}</>;
	}

	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
