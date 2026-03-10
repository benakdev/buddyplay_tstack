'use client';

import * as React from 'react';

import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, Loader2, MessageCircle, UserPlus, Users, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ── per-type config ─────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; dot: string; bg: string }> = {
  MESSAGE: { icon: MessageCircle, dot: 'bg-blue-500', bg: 'bg-blue-500/10' },
  REQUEST: { icon: UserPlus, dot: 'bg-amber-500', bg: 'bg-amber-500/10' },
  APPROVED: { icon: Check, dot: 'bg-emerald-500', bg: 'bg-emerald-500/10' },
  REJECTED: { icon: X, dot: 'bg-destructive', bg: 'bg-destructive/10' },
  ACTIVITY_ALERT: { icon: Zap, dot: 'bg-primary', bg: 'bg-primary/10' },
  PLAYER_MATCH: { icon: Users, dot: 'bg-violet-500', bg: 'bg-violet-500/10' }
};
const FALLBACK_META = { icon: Bell, dot: 'bg-muted-foreground', bg: 'bg-muted' };

interface NotifData {
  conversationId?: Id<'conversations'>;
  matchingUserId?: Id<'users'>;
  actorUserId?: Id<'users'>;
  senderId?: Id<'users'>;
  requesterId?: Id<'users'>;
  userId?: Id<'users'>;
  requestId?: Id<'requests'>;
}

// ── compact dropdown row ────────────────────────────────────────────────────
function DropdownNotifRow({
  item,
  onClose
}: {
  item: {
    notification: Doc<'notifications'>;
    actor: { _id: Id<'users'>; username: string; tokenIdentifier: string } | null;
  };
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const markAsRead = useMutation(api.notifications.markAsRead);
  const { notification } = item;
  const meta = TYPE_META[notification.type] ?? FALLBACK_META;
  const Icon = meta.icon;
  const timeAgo = formatDistanceToNow(new Date(notification._creationTime), { addSuffix: true });

  const handleClick = async () => {
    if (!notification.read) {
      await markAsRead({ notificationId: notification._id });
    }
    const data = notification.data as NotifData | undefined;
    if (notification.type === 'MESSAGE' && data?.conversationId) {
      void navigate({ to: '/inbox', search: { conversationId: String(data.conversationId) } });
    }
    onClose();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted/60',
        !notification.read && 'bg-primary/5'
      )}
    >
      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
        <Icon className={cn('size-3.5', meta.dot.replace('bg-', 'text-'))} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', !notification.read && 'font-semibold')}>{notification.title}</p>
        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{notification.body}</p>
        <span className="text-muted-foreground/60 mt-1 block text-[11px]">{timeAgo}</span>
      </div>
      {!notification.read && <span className={cn('mt-2 size-2 shrink-0 rounded-full', meta.dot)} />}
    </button>
  );
}

// ── bell component ──────────────────────────────────────────────────────────
export function NotificationBell() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const [open, setOpen] = React.useState(false);

  // On mobile, bell navigates directly to the notifications page
  if (isMobile) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative size-8"
        onClick={() => void navigate({ to: '/notifications' })}
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {(unreadCount ?? 0) > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
            {unreadCount! > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    );
  }

  // Desktop: popover dropdown
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label="Notifications">
          <Bell className="size-4" />
          {(unreadCount ?? 0) > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
              {unreadCount! > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 overflow-hidden p-0" sideOffset={8}>
        <DesktopDropdownContent onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function DesktopDropdownContent({ onClose }: { onClose: () => void }) {
  const notifications = useQuery(api.notifications.getMyNotificationsEnriched, { limit: 8 });
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const [markingAll, setMarkingAll] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = React.useState(false);
  const [showBottomFade, setShowBottomFade] = React.useState(false);

  const updateScrollFades = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }

    const canScrollUp = el.scrollTop > 2;
    const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;

    setShowTopFade(canScrollUp);
    setShowBottomFade(canScrollDown);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const raf = requestAnimationFrame(updateScrollFades);
    el.addEventListener('scroll', updateScrollFades, { passive: true });
    window.addEventListener('resize', updateScrollFades);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', updateScrollFades);
      window.removeEventListener('resize', updateScrollFades);
    };
  }, [notifications, updateScrollFades]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead({});
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Notifications</span>
          {(unreadCount ?? 0) > 0 && (
            <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>
        {(unreadCount ?? 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? <Loader2 className="mr-1 size-3 animate-spin" /> : <CheckCheck className="mr-1 size-3" />}
            Mark all read
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="relative">
        <div ref={scrollRef} className="max-h-[24rem] overflow-y-auto">
          {notifications === undefined ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5">
                  <Skeleton className="size-7 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Bell className="text-muted-foreground/40 size-8" />
              <p className="text-muted-foreground text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map(item => (
                <DropdownNotifRow key={item.notification._id} item={item} onClose={onClose} />
              ))}
            </div>
          )}
        </div>
        <div
          className={cn(
            'from-popover pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b to-transparent transition-opacity',
            showTopFade ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'from-popover pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t to-transparent transition-opacity',
            showBottomFade ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2.5">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground block text-center text-xs font-medium transition-colors"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
