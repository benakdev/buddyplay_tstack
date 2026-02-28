'use client';

import * as React from 'react';

import { useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { Check, Loader2, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

interface NotificationData {
  actorUserId?: Id<'users'>;
  userId?: Id<'users'>;
  username?: string;
  imageUrl?: string;
  conversationId?: Id<'conversations'>;
  senderId?: Id<'users'>;
  requesterId?: Id<'users'>;
  matchingUserId?: Id<'users'>;
  messageId?: Id<'messages'>;
  requestId?: Id<'requests'>;
}

interface NotificationActor {
  _id: Id<'users'>;
  username: string;
  tokenIdentifier: string;
}

interface NotificationItemProps {
  item: {
    notification: Doc<'notifications'>;
    actor: NotificationActor | null;
  };
  className?: string;
}

/** Notification types that should show a "Message" button. */
const MESSAGEABLE_TYPES = new Set(['PLAYER_MATCH', 'MESSAGE', 'APPROVED', 'ACTIVITY_ALERT']);

/**
 * NotificationItem - A single row in the notifications feed.
 * Marks as read on click and provides a "Message" action that
 * creates or finds an existing DM and navigates to the inbox.
 */
export function NotificationItem({ item, className }: NotificationItemProps) {
  const { notification, actor } = item;
  const navigate = useNavigate();
  const markAsRead = useMutation(api.notifications.markAsRead);
  const createDM = useMutation(api.conversations.createDM);
  const approveRequest = useMutation(api.requests.approveRequest);
  const rejectRequest = useMutation(api.requests.rejectRequest);
  const [isCreatingDM, setIsCreatingDM] = React.useState(false);
  const [pendingRequestAction, setPendingRequestAction] = React.useState<'approve' | 'reject' | null>(null);
  const [handledRequestAction, setHandledRequestAction] = React.useState<'approve' | 'reject' | null>(null);

  const markReadIfNeeded = async () => {
    if (!notification.read) {
      await markAsRead({ notificationId: notification._id });
    }
  };

  const handleClick = async () => {
    await markReadIfNeeded();
  };

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the row's onClick
    setIsCreatingDM(true);

    try {
      const data = notification.data as NotificationData | undefined;

      // If it's a MESSAGE notification, we already have the conversationId
      if (notification.type === 'MESSAGE' && data?.conversationId) {
        void navigate({
          to: '/inbox',
          search: { conversationId: String(data.conversationId) }
        });
        return;
      }

      // For other types, find or create a DM with the relevant user
      const targetUserId =
        data?.matchingUserId ?? data?.actorUserId ?? data?.senderId ?? data?.requesterId ?? data?.userId ?? actor?._id;
      if (!targetUserId) {
        void navigate({ to: '/inbox' });
        return;
      }

      const conversationId = await createDM({ otherUserId: targetUserId });
      void navigate({
        to: '/inbox',
        search: { conversationId: String(conversationId) }
      });
    } catch {
      void navigate({ to: '/inbox' });
    } finally {
      setIsCreatingDM(false);
    }
  };

  const handleApproveRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = notification.data as NotificationData | undefined;
    if (!data?.requestId) {
      toast.error('Could not find request details.');
      return;
    }

    setPendingRequestAction('approve');
    try {
      await approveRequest({ requestId: data.requestId });
      await markReadIfNeeded();
      setHandledRequestAction('approve');
      toast.success('Request approved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve request.';
      if (message.toLowerCase().includes('not pending')) {
        await markReadIfNeeded();
        setHandledRequestAction('approve');
        toast('Request was already handled.');
      } else {
        toast.error(message);
      }
    } finally {
      setPendingRequestAction(null);
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = notification.data as NotificationData | undefined;
    if (!data?.requestId) {
      toast.error('Could not find request details.');
      return;
    }

    setPendingRequestAction('reject');
    try {
      await rejectRequest({ requestId: data.requestId });
      await markReadIfNeeded();
      setHandledRequestAction('reject');
      toast.success('Request declined.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline request.';
      if (message.toLowerCase().includes('not pending')) {
        await markReadIfNeeded();
        setHandledRequestAction('reject');
        toast('Request was already handled.');
      } else {
        toast.error(message);
      }
    } finally {
      setPendingRequestAction(null);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification._creationTime), {
    addSuffix: true
  });

  // Extract data if available
  const data = notification.data as NotificationData | undefined;
  const avatarName = actor?.username ?? data?.username ?? 'User';
  const showMessageButton = MESSAGEABLE_TYPES.has(notification.type);
  const showRequestActions = notification.type === 'REQUEST';
  const isRequestHandled = handledRequestAction !== null;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-lg p-4 transition-colors',
        !notification.read && 'bg-primary/5',
        'hover:bg-muted/50',
        className
      )}
    >
      {/* Unread indicator */}
      <div className="relative">
        {!notification.read && (
          <span className="bg-primary absolute top-1/2 -left-2 size-2 -translate-y-1/2 rounded-full" />
        )}
        <UserAvatar className="size-10" tokenIdentifier={actor?.tokenIdentifier ?? ''} username={avatarName} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !notification.read && 'font-medium')}>{notification.title}</p>
        <p className="text-muted-foreground truncate text-xs">{notification.body}</p>
      </div>

      {/* Time + Action */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-muted-foreground text-xs">{timeAgo}</span>
        {showRequestActions && !isRequestHandled ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleRejectRequest}
              disabled={pendingRequestAction !== null}
            >
              {pendingRequestAction === 'reject' ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <X className="mr-1.5 size-4" />
              )}
              Reject
            </Button>
            <Button size="sm" className="h-8" onClick={handleApproveRequest} disabled={pendingRequestAction !== null}>
              {pendingRequestAction === 'approve' ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-4" />
              )}
              Approve
            </Button>
          </div>
        ) : showRequestActions ? (
          <Badge variant="outline">{handledRequestAction === 'approve' ? 'Approved' : 'Declined'}</Badge>
        ) : showMessageButton ? (
          <Button variant="outline" size="sm" className="h-8" onClick={handleMessage} disabled={isCreatingDM}>
            {isCreatingDM ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <MessageCircle className="mr-1.5 size-4" />
            )}
            Message
          </Button>
        ) : null}
      </div>
    </div>
  );
}
