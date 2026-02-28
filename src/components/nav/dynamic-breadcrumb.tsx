"use client";

import { useLocation } from "@tanstack/react-router";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";

// Map route segments to readable page names
const PAGE_NAMES: Record<string, string> = {
	dashboard: "Dashboard",
	finder: "Finder",
	inbox: "Inbox",
	alerts: "Alerts",
	profile: "Profile",
};

export function DynamicBreadcrumb() {
	const pathname = useLocation({ select: (state) => state.pathname });

	// Get the current page from the pathname
	// e.g., "/dashboard" -> "dashboard", "/inbox" -> "inbox"
	const segments = pathname.split("/").filter(Boolean);
	const currentPage = segments[segments.length - 1] || "dashboard";

	// Get the display name for the current page
	const displayName =
		PAGE_NAMES[currentPage] ||
		currentPage.charAt(0).toUpperCase() + currentPage.slice(1);

	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbPage>{displayName}</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
