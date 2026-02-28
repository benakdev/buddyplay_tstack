import { useAuth } from "@clerk/tanstack-react-start";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { DynamicBreadcrumb } from "@/components/nav/dynamic-breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useStoreUserEffect } from "@/useStoreUserEffect";

export const Route = createFileRoute("/_app")({
	component: ProtectedLayout,
});

function ProtectedLayout() {
	const { isLoaded, isSignedIn } = useAuth();

	if (!isLoaded) {
		return <div className="bg-background min-h-screen" />;
	}

	if (!isSignedIn) {
		return <Navigate to="/" replace />;
	}

	return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
	const { isLoading } = useStoreUserEffect();

	if (isLoading) {
		return <div className="bg-background min-h-screen" />;
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<DynamicBreadcrumb />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
