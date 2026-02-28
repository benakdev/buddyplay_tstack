'use client';

import * as React from 'react';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { ChatListItem } from './chat-list-item';

export interface ChatListConversation {
  /** Conversation ID. */
  id: string;
  /** Props forwarded to ChatListItem. */
  name: string;
  avatarUrl?: string;
  tokenIdentifier?: string;
  initials?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  type?: 'DM' | 'ACTIVITY';
}

export interface ChatListProps {
  /** List of conversations to render. */
  conversations: ChatListConversation[];
  /** Currently active conversation ID. */
  activeId?: string | null;
  /** Called when a conversation is selected. */
  onSelect?: (conversationId: string) => void;
  /** Whether data is still loading. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Searchable list of conversations. Includes a search bar that filters
 * by name, and renders `ChatListItem` for each conversation.
 */
export function ChatList({ conversations, activeId, onSelect, isLoading = false, className }: ChatListProps) {
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => c.name.toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Search */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center px-4 py-12 text-center text-sm">
            {search ? <p>No conversations match &ldquo;{search}&rdquo;</p> : <p>No conversations yet</p>}
          </div>
        ) : (
          filtered.map(conv => (
            <ChatListItem
              key={conv.id}
              name={conv.name}
              avatarUrl={conv.avatarUrl}
              tokenIdentifier={conv.tokenIdentifier}
              initials={conv.initials}
              lastMessage={conv.lastMessage}
              lastMessageAt={conv.lastMessageAt}
              type={conv.type}
              isActive={conv.id === activeId}
              onClick={() => onSelect?.(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
