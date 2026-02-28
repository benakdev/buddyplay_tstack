'use client';

import * as React from 'react';

import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCircle2, Loader2, MessageCircle, UserPlus, Users, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
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
const FALLBACK_META = {
  icon: Bell,
  dot: 'bg-muted-foreground',
  bg: 'bg-muted'
};

interface NotifData {
  requestId?: Id<'requests'>;
  matchingUserId?: Id<'users'>;
  actorUserId?: Id<'users'>;
  senderId?: Id<'users'>;
  requesterId?: Id<'users'>;
  userId?: Id<'users'>;
  conversationId?: Id<'conversations'>;
}

// ── single compact carousel card ────────────────────────────────────────────
function NotifCard({
  item
}: {
  item: {
    notification: Doc<'notifications'>;
    actor: {
      _id: Id<'users'>;
      username: string;
      tokenIdentifier: string;
    } | null;
  };
}) {
  const navigate = useNavigate();
  const markAsRead = useMutation(api.notifications.markAsRead);
  const createDM = useMutation(api.conversations.createDM);
  const approveRequest = useMutation(api.requests.approveRequest);
  const rejectRequest = useMutation(api.requests.rejectRequest);

  const [dmLoading, setDmLoading] = React.useState(false);
  const [reqAction, setReqAction] = React.useState<'approve' | 'reject' | null>(null);
  const [reqDone, setReqDone] = React.useState<'approve' | 'reject' | null>(null);

  const { notification, actor } = item;
  const meta = TYPE_META[notification.type] ?? FALLBACK_META;
  const Icon = meta.icon;
  const data = notification.data as NotifData | undefined;
  const timeAgo = formatDistanceToNow(new Date(notification._creationTime), {
    addSuffix: true
  });

  const markRead = async () => {
    if (!notification.read) await markAsRead({ notificationId: notification._id });
  };

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDmLoading(true);
    try {
      await markRead();
      if (notification.type === 'MESSAGE' && data?.conversationId) {
        void navigate({
          to: '/inbox',
          search: { conversationId: String(data.conversationId) }
        });
        return;
      }
      const target =
        data?.matchingUserId ?? data?.actorUserId ?? data?.senderId ?? data?.requesterId ?? data?.userId ?? actor?._id;
      if (!target) {
        void navigate({ to: '/inbox' });
        return;
      }
      const convId = await createDM({ otherUserId: target });
      void navigate({ to: '/inbox', search: { conversationId: String(convId) } });
    } catch {
      void navigate({ to: '/inbox' });
    } finally {
      setDmLoading(false);
    }
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data?.requestId) return;
    setReqAction('approve');
    try {
      await approveRequest({ requestId: data.requestId });
      await markRead();
      setReqDone('approve');
      toast.success('Request approved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('not pending')) {
        setReqDone('approve');
        await markRead();
      } else toast.error(msg || 'Could not approve.');
    } finally {
      setReqAction(null);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data?.requestId) return;
    setReqAction('reject');
    try {
      await rejectRequest({ requestId: data.requestId });
      await markRead();
      setReqDone('reject');
      toast.success('Request declined.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('not pending')) {
        setReqDone('reject');
        await markRead();
      } else toast.error(msg || 'Could not decline.');
    } finally {
      setReqAction(null);
    }
  };

  const showMessage = ['PLAYER_MATCH', 'MESSAGE', 'APPROVED', 'ACTIVITY_ALERT'].includes(notification.type);
  const showRequest = notification.type === 'REQUEST';

  return (
    <div
      onClick={markRead}
      className={cn(
        'relative flex h-full w-full cursor-pointer flex-col justify-between gap-3 rounded-xl border p-4 transition-colors',
        notification.read ? 'bg-card' : cn('bg-card', meta.bg),
        'hover:border-border/80'
      )}
    >
      {/* Unread dot */}
      {!notification.read && <span className={cn('absolute top-3 right-3 size-2 rounded-full', meta.dot)} />}

      {/* Top: icon + title */}
      <div className="flex items-start gap-3 pr-4">
        <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
          <Icon className={cn('size-3.5', meta.dot.replace('bg-', 'text-'))} />
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm leading-snug', !notification.read && 'font-semibold')}>{notification.title}</p>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">{notification.body}</p>
        </div>
      </div>

      {/* Bottom: time + actions */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground/60 text-[11px]">{timeAgo}</span>

        {showRequest && !reqDone ? (
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={handleReject}
              disabled={reqAction !== null}
            >
              {reqAction === 'reject' ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            </Button>
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={handleApprove} disabled={reqAction !== null}>
              {reqAction === 'approve' ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            </Button>
          </div>
        ) : showRequest && reqDone ? (
          <span className="text-muted-foreground text-[11px] font-medium">
            {reqDone === 'approve' ? '✓ Approved' : '✗ Declined'}
          </span>
        ) : showMessage ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={handleMessage}
            disabled={dmLoading}
          >
            {dmLoading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <MessageCircle className="mr-1 size-3" />}
            Reply
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ── widget ───────────────────────────────────────────────────────────────────
export function DashboardNotificationsWidget() {
  const notifications = useQuery(api.notifications.getMyNotificationsEnriched, {
    limit: 8
  });
  const unreadCount = notifications?.filter(n => !n.notification.read).length ?? 0;

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Bell className="text-muted-foreground size-4" />
          <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>
        <Link
          to="/alerts"
          className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* Carousel */}
      {notifications === undefined ? (
        /* Skeleton */
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/40 h-29.5 w-65 shrink-0 animate-pulse rounded-xl border" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-muted/20 flex items-center gap-3 rounded-xl border px-5 py-5">
          <CheckCircle2 className="text-primary/50 size-8 shrink-0" />
          <div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-muted-foreground text-xs">No new notifications right now.</p>
          </div>
        </div>
      ) : (
        <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {notifications.map(item => (
              <CarouselItem key={item.notification._id} className="basis-[min(260px,80vw)] pl-3">
                <NotifCard item={item} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
}
