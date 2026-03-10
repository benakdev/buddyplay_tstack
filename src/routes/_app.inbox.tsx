import * as React from 'react';

import { useUser } from '@clerk/tanstack-react-start';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ArrowUp, EyeOff, MessageCircle, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Chat as ChatRoot } from '@/components/chat/chat';
import {
  ChatEvent,
  ChatEventAddon,
  ChatEventAvatar,
  ChatEventBody,
  ChatEventTime,
  ChatEventTitle
} from '@/components/chat/chat-event';
import {
  ChatHeader,
  ChatHeaderAddon,
  ChatHeaderAvatar,
  ChatHeaderButton,
  ChatHeaderMain
} from '@/components/chat/chat-header';
import { ChatList, type ChatListConversation } from '@/components/chat/chat-list';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatToolbar, ChatToolbarButton, ChatToolbarTextarea } from '@/components/chat/chat-toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getUserDisplayName } from '@/lib/user-display';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/inbox')({
  validateSearch: (search: Record<string, unknown>) => ({
    conversationId: typeof search.conversationId === 'string' ? search.conversationId : undefined
  }),
  component: InboxPage
});

function extractClerkUserId(tokenIdentifier?: string): string | null {
  if (!tokenIdentifier) return null;
  return tokenIdentifier.split('|').pop() ?? null;
}

function isOtherParticipant(
  participantTokenIdentifier: string,
  clerkUserId?: string,
  currentUserTokenIdentifier?: string
) {
  if (clerkUserId) {
    return extractClerkUserId(participantTokenIdentifier) !== clerkUserId;
  }

  if (currentUserTokenIdentifier) {
    return participantTokenIdentifier !== currentUserTokenIdentifier;
  }

  return true;
}

function InboxPage() {
  const navigate = useNavigate();
  const { conversationId } = Route.useSearch();
  const { user: clerkUser } = useUser();
  const activeConversationId = (conversationId as Id<'conversations'> | undefined) ?? null;

  const currentUser = useQuery(api.users.getCurrentUser);
  const conversationsData = useQuery(api.conversations.getMyConversations, {
    limit: 50
  });
  const conversationDetail = useQuery(
    api.conversations.getConversation,
    activeConversationId ? { conversationId: activeConversationId } : 'skip'
  );
  const messages = useQuery(
    api.messages.getMessages,
    activeConversationId ? { conversationId: activeConversationId, limit: 100 } : 'skip'
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const hideConversation = useMutation(api.conversations.hideConversation);
  const [messageText, setMessageText] = React.useState('');
  const [isHidingConversation, setIsHidingConversation] = React.useState(false);

  const isLoading = conversationsData === undefined;
  const conversations: ChatListConversation[] = React.useMemo(() => {
    if (!conversationsData) return [];
    return conversationsData.map(item => {
      const conv = item.conversation;
      const participants = item.participants;
      const dmOtherParticipant =
        conv.type === 'DM'
          ? participants.find(participant =>
              isOtherParticipant(participant.tokenIdentifier, clerkUser?.id, currentUser?.tokenIdentifier)
            )
          : undefined;

      const displayName =
        conv.type === 'DM'
          ? dmOtherParticipant
            ? getUserDisplayName(dmOtherParticipant)
            : 'Conversation'
          : conv.type === 'ACTIVITY'
            ? (conv.name ?? 'Group Chat')
            : participants.length > 0
              ? participants.map(p => getUserDisplayName(p)).join(', ')
              : 'Conversation';

      const dmTokenIdentifier = conv.type === 'DM' ? dmOtherParticipant?.tokenIdentifier : undefined;

      return {
        id: conv._id,
        name: displayName,
        avatarUrl: dmOtherParticipant?.profileUrl,
        tokenIdentifier: dmTokenIdentifier,
        lastMessage: conv.lastMessagePreview ?? undefined,
        lastMessageAt: conv.lastMessageAt ?? undefined,
        type: conv.type as 'DM' | 'ACTIVITY',
        initials: displayName.charAt(0).toUpperCase()
      };
    });
  }, [clerkUser, conversationsData, currentUser]);

  const handleSelectConversation = (selectedConversationId: string) => {
    void navigate({
      to: '/inbox',
      search: { conversationId: selectedConversationId }
    });
  };

  const handleBack = () => {
    void navigate({ to: '/inbox', search: { conversationId: undefined } });
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !activeConversationId) return;
    setMessageText('');
    await sendMessage({
      conversationId: activeConversationId,
      content: text
    });
  };

  const handleHideConversation = async () => {
    if (!activeConversationId || conversationDetail?.conversation.type !== 'DM' || isHidingConversation) return;

    setIsHidingConversation(true);
    try {
      await hideConversation({ conversationId: activeConversationId });
      toast.success('Chat hidden.');
      setMessageText('');
      void navigate({ to: '/inbox', search: { conversationId: undefined } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to hide chat.';
      toast.error(message);
    } finally {
      setIsHidingConversation(false);
    }
  };

  const headerInfo = React.useMemo(() => {
    if (!conversationDetail) {
      return {
        name: '',
        tokenIdentifier: undefined as string | undefined,
        profileUrl: undefined as string | undefined
      };
    }

    const conv = conversationDetail.conversation;
    if (conv.type === 'DM') {
      const other = conversationDetail.participants.find(participant =>
        isOtherParticipant(participant.tokenIdentifier, clerkUser?.id, currentUser?.tokenIdentifier)
      );
      return {
        name: other ? getUserDisplayName(other) : 'Chat',
        tokenIdentifier: other?.tokenIdentifier,
        profileUrl: other?.profileUrl
      };
    }

    if (conv.type === 'ACTIVITY') {
      return {
        name: conv.name ?? 'Group Chat',
        tokenIdentifier: undefined,
        profileUrl: undefined
      };
    }

    const others = conversationDetail.participants;
    return {
      name: others.length > 0 ? others.map(p => getUserDisplayName(p)).join(', ') : 'Chat',
      tokenIdentifier: undefined,
      profileUrl: undefined
    };
  }, [clerkUser, conversationDetail, currentUser]);

  const headerName = headerInfo.name;
  const headerInitials = headerName.charAt(0).toUpperCase();
  const hasActiveChat = !!activeConversationId;
  const isActiveDm = conversationDetail?.conversation.type === 'DM';

  return (
    <div className="border-border/70 bg-card/70 flex min-h-0 flex-1 overflow-hidden rounded-3xl border shadow-sm">
      <div className={cn('flex-col border-r', 'md:flex md:w-80 lg:w-96', hasActiveChat ? 'hidden' : 'flex w-full')}>
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
        </div>
        <ChatList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          isLoading={isLoading}
        />
      </div>

      <div className={cn('flex-1 flex-col', 'md:flex', hasActiveChat ? 'flex w-full' : 'hidden')}>
        {hasActiveChat ? (
          <ChatRoot className="h-full">
            <ChatHeader className="border-b">
              <ChatHeaderAddon>
                <ChatHeaderButton className="md:hidden" onClick={handleBack} aria-label="Back to conversations">
                  <ArrowLeft />
                </ChatHeaderButton>
                {headerInfo.tokenIdentifier ? (
                  <UserAvatar
                    className="size-8 rounded-full"
                    profileUrl={headerInfo.profileUrl}
                    tokenIdentifier={headerInfo.tokenIdentifier}
                    username={headerName || 'User'}
                    fallbackClassName="text-xs"
                  />
                ) : (
                  <ChatHeaderAvatar fallback={headerInitials} />
                )}
              </ChatHeaderAddon>
              <ChatHeaderMain>
                <span className="truncate font-medium">{headerName || <Skeleton className="h-4 w-24" />}</span>
              </ChatHeaderMain>
              {isActiveDm ? (
                <ChatHeaderAddon>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ChatHeaderButton
                        aria-label="Conversation options"
                        disabled={isHidingConversation}
                        className="text-muted-foreground"
                      >
                        <MoreHorizontal />
                      </ChatHeaderButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8}>
                      <DropdownMenuItem onClick={() => void handleHideConversation()} disabled={isHidingConversation}>
                        <EyeOff className="mr-2 size-4" />
                        Hide chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ChatHeaderAddon>
              ) : null}
            </ChatHeader>

            <ChatMessages>
              {messages === undefined ? (
                <div className="space-y-4 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8">
                  <p className="text-muted-foreground text-sm">No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {messages.map(item => {
                    const senderClerkUserId = extractClerkUserId(item.sender.tokenIdentifier);
                    const isMe =
                      (!!clerkUser?.id && senderClerkUserId === clerkUser.id) ||
                      (!!currentUser && item.sender.tokenIdentifier === currentUser.tokenIdentifier);
                    return (
                      <ChatEvent key={item.message._id} isMe={!!isMe} className="hover:bg-accent/50 rounded py-1">
                        <ChatEventAddon>
                          <ChatEventAvatar
                            src={item.sender.profileUrl}
                            tokenIdentifier={item.sender.tokenIdentifier}
                            username={getUserDisplayName(item.sender)}
                            fallback={item.sender.username.charAt(0).toUpperCase()}
                          />
                        </ChatEventAddon>
                        <ChatEventBody>
                          <ChatEventTitle className={cn(isMe && 'justify-end gap-2')}>
                            <span className="text-muted-foreground text-xs font-normal">
                              {getUserDisplayName(item.sender)}
                            </span>
                            <ChatEventTime
                              timestamp={item.message._creationTime}
                              format="time"
                              className="text-muted-foreground/50 text-xs"
                            />
                          </ChatEventTitle>
                          <div className={cn('mt-1 flex w-full', isMe ? 'justify-end' : 'justify-start')}>
                            <div
                              className={cn(
                                'max-w-[85%] rounded-2xl px-4 py-2',
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted text-foreground rounded-tl-sm'
                              )}
                            >
                              <div className="text-sm whitespace-pre-wrap">{item.message.content}</div>
                            </div>
                          </div>
                        </ChatEventBody>
                      </ChatEvent>
                    );
                  })}
                </div>
              )}
            </ChatMessages>

            <ChatToolbar className="border-t-0 px-3 pt-1 pb-3">
              <div className="focus-within:border-primary/25 relative flex w-full items-stretch overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_16px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-all duration-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_16px_rgba(0,0,0,0.22),0_0_28px_rgba(210,255,0,0.06)]">
                <ChatToolbarTextarea
                  className="placeholder:text-muted-foreground/35 min-h-12 resize-none border-none bg-transparent py-3.5 pr-14 pl-5 text-sm leading-relaxed shadow-none focus-visible:border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onSubmit={handleSend}
                  placeholder="Message..."
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
                  <ChatToolbarButton
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    aria-label="Send message"
                    className={cn(
                      'pointer-events-auto size-9 shrink-0 rounded-full border-0 transition-all duration-200',
                      messageText.trim()
                        ? 'bg-primary hover:bg-primary text-black shadow-[0_0_0_1px_rgba(210,255,0,0.2),0_2px_16px_rgba(210,255,0,0.22)] hover:scale-[1.07] hover:shadow-[0_0_0_1px_rgba(210,255,0,0.32),0_4px_24px_rgba(210,255,0,0.38)] active:scale-[0.93]'
                        : 'text-muted-foreground/25 bg-transparent hover:bg-white/5'
                    )}
                  >
                    <ArrowUp className="size-[18px]" strokeWidth={2.5} />
                  </ChatToolbarButton>
                </div>
              </div>
            </ChatToolbar>
          </ChatRoot>
        ) : (
          <div className="hidden h-full items-center justify-center md:flex">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircle />
                </EmptyMedia>
                <EmptyTitle>Select a conversation</EmptyTitle>
                <EmptyDescription>Choose a conversation from the list to start chatting.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}
