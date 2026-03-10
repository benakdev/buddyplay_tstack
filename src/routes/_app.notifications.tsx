'use client';

import * as React from 'react';

import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Bell, CheckCheck, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { NotificationItem } from '@/components/alerts';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage
});

type FilterMode = 'all' | 'unread';

function NotificationsPage() {
  const [filter, setFilter] = React.useState<FilterMode>('all');

  const notifications = useQuery(api.notifications.getMyNotificationsEnriched, {
    limit: 100,
    unreadOnly: filter === 'unread'
  });
  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const clearRead = useMutation(api.notifications.clearReadNotifications);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const isLoading = notifications === undefined;

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const count = await markAllAsRead({});
      if (count > 0) {
        toast.success(`Marked ${count} notification${count > 1 ? 's' : ''} as read`);
      }
    } catch {
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClearRead = async () => {
    setClearing(true);
    try {
      const count = await clearRead({});
      if (count > 0) {
        toast.success(`Cleared ${count} read notification${count > 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container max-w-3xl space-y-6 px-4 py-4 sm:py-8">
      <div className="border-border/70 rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted)/0.45)_100%)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Notifications</h1>
            <p className="text-muted-foreground text-sm leading-6 sm:text-base">
              {unreadCount !== undefined && unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(unreadCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markingAll}>
                {markingAll ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-1.5 size-4" />
                )}
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearRead}
              disabled={clearing}
              className="text-muted-foreground"
            >
              {clearing && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Clear read
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border p-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            filter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            filter === 'unread'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Unread
          {(unreadCount ?? 0) > 0 && (
            <span className="bg-primary text-primary-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="border-border/70 bg-card/70 overflow-hidden rounded-3xl border shadow-sm">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg p-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">{filter === 'unread' ? <Filter /> : <Bell />}</EmptyMedia>
                <EmptyTitle>{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</EmptyTitle>
                <EmptyDescription>
                  {filter === 'unread'
                    ? "You're all caught up! Switch to All to see previous notifications."
                    : 'Game updates, requests, matches, and messages will appear here.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(item => (
              <NotificationItem key={item.notification._id} item={item} className="rounded-none border-0" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
