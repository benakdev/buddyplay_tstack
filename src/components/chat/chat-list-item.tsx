'use client';

import { formatDistanceToNow } from 'date-fns';

import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

export interface ChatListItemProps {
  /** Display name for this conversation (username for DMs, title for groups). */
  name: string;
  avatarUrl?: string; // Keep for backward compat or direct URLs
  /** Token identifier for fetching avatar from Clerk. */
  tokenIdentifier?: string;
  /** Fallback initials for the avatar. */
  initials?: string;
  /** Preview text of the last message (already truncated by backend). */
  lastMessage?: string;
  /** Timestamp of the last message (ms since epoch). */
  lastMessageAt?: number;
  /** Whether this item is currently selected / active. */
  isActive?: boolean;
  /** Conversation type label (DM or ACTIVITY). */
  type?: 'DM' | 'ACTIVITY';
  /** Click handler. */
  onClick?: () => void;
  className?: string;
}

/**
 * A single row in the chat list sidebar. Displays avatar, name,
 * last message preview, and time. Highlights when active.
 */
export function ChatListItem({
  name,
  avatarUrl,
  tokenIdentifier,
  lastMessage,
  lastMessageAt,
  isActive = false,
  type,
  onClick,
  className
}: ChatListItemProps) {
  const timeLabel = lastMessageAt ? formatDistanceToNow(new Date(lastMessageAt), { addSuffix: false }) : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground',
        className
      )}
    >
      <UserAvatar
        className="size-10 shrink-0"
        profileUrl={avatarUrl}
        tokenIdentifier={tokenIdentifier || ''}
        username={name}
        fallbackClassName="text-xs"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{name}</span>
          {timeLabel && <span className="text-muted-foreground shrink-0 text-xs">{timeLabel}</span>}
        </div>
        {lastMessage && <p className="text-muted-foreground mt-0.5 truncate text-xs">{lastMessage}</p>}
      </div>

      {type === 'ACTIVITY' && (
        <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">Group</span>
      )}
    </button>
  );
}
