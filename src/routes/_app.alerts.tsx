import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";

import { AlertCard, NotificationItem } from "@/components/alerts";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";

export const Route = createFileRoute("/_app/alerts")({
	component: AlertsPage,
});

function AlertsPage() {
	const alerts = useQuery(api.alerts.getMyAlerts);
	const notifications = useQuery(api.notifications.getMyNotificationsEnriched, {
		limit: 50,
	});
	const unreadNotifications = useQuery(
		api.notifications.getMyNotificationsEnriched,
		{ unreadOnly: true, limit: 50 },
	);
	const markAllAsRead = useMutation(api.notifications.markAllAsRead);

	const [isMarkingAll, setIsMarkingAll] = React.useState(false);

	const handleMarkAllRead = async () => {
		setIsMarkingAll(true);
		try {
			await markAllAsRead({});
		} finally {
			setIsMarkingAll(false);
		}
	};

	const isAlertsLoading = alerts === undefined;
	const isNotificationsLoading = notifications === undefined;
	const isVisibleNotification = (
		item: NonNullable<typeof notifications>[number],
	) =>
		item.notification.type !== "PLAYER_MATCH" ||
		item.notification.matchStatus === "ACTIVE" ||
		item.notification.matchStatus === undefined;

	const visibleNotifications =
		notifications?.filter(isVisibleNotification) ?? [];
	const visibleUnreadNotifications =
		unreadNotifications?.filter(isVisibleNotification) ?? [];
	const unreadCount = visibleUnreadNotifications.length;

	return (
		<div className="container max-w-5xl space-y-12 py-12">
			<div>
				<h1 className="text-4xl font-bold tracking-tight">Alerts Hub</h1>
				<p className="text-muted-foreground mt-2">
					Manage your passive matchmaking criteria and review matches.
				</p>
			</div>

			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-xl font-semibold">
						<Bell className="text-primary size-5" />
						My Passport Alerts
					</h2>
					{alerts && alerts.length > 0 && (
						<span className="text-muted-foreground text-sm">
							{alerts.filter((a) => a.active).length} active
						</span>
					)}
				</div>

				<div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
					{isAlertsLoading ? (
						<>
							<Skeleton className="h-36 min-w-65 rounded-lg" />
							<Skeleton className="h-36 min-w-65 rounded-lg" />
						</>
					) : alerts.length === 0 ? (
						<Empty className="w-full">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Bell />
								</EmptyMedia>
								<EmptyTitle>No alerts yet</EmptyTitle>
								<EmptyDescription>
									Create a Sport Passport to automatically generate an alert.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						alerts.map((alert) => <AlertCard key={alert._id} alert={alert} />)
					)}
				</div>
			</section>

			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold">Recent Notifications</h2>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleMarkAllRead}
							disabled={isMarkingAll}
							className="text-muted-foreground hover:text-foreground"
						>
							<CheckCheck className="mr-1.5 size-4" />
							Mark all read
						</Button>
					)}
				</div>

				<Tabs defaultValue="all" className="w-full">
					<TabsList variant="line">
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="unread">
							Unread
							{unreadCount > 0 && (
								<span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
									{unreadCount}
								</span>
							)}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="all" className="mt-4 space-y-1">
						{isNotificationsLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-20 rounded-lg" />
								<Skeleton className="h-20 rounded-lg" />
								<Skeleton className="h-20 rounded-lg" />
							</div>
						) : visibleNotifications.length === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Bell />
									</EmptyMedia>
									<EmptyTitle>No notifications</EmptyTitle>
									<EmptyDescription>
										You&apos;ll see match notifications here when they arrive.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							visibleNotifications.map((item) => (
								<NotificationItem key={item.notification._id} item={item} />
							))
						)}
					</TabsContent>

					<TabsContent value="unread" className="mt-4 space-y-1">
						{isNotificationsLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-20 rounded-lg" />
								<Skeleton className="h-20 rounded-lg" />
							</div>
						) : unreadCount === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<CheckCheck />
									</EmptyMedia>
									<EmptyTitle>All caught up!</EmptyTitle>
									<EmptyDescription>No unread notifications.</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							visibleUnreadNotifications.map((item) => (
								<NotificationItem key={item.notification._id} item={item} />
							))
						)}
					</TabsContent>
				</Tabs>
			</section>
		</div>
	);
}
