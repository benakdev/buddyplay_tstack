import * as React from 'react';

import { useUser } from '@clerk/tanstack-react-start';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Bell, MessageCircle, Send } from 'lucide-react';

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
import { ChatToolbar, ChatToolbarAddon, ChatToolbarButton, ChatToolbarTextarea } from '@/components/chat/chat-toolbar';
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
  const notifications = useQuery(api.notifications.getMyNotificationsEnriched, {
    limit: 50
  });

  const sendMessage = useMutation(api.messages.sendMessage);
  const markNotificationAsRead = useMutation(api.notifications.markAsRead);
  const [messageText, setMessageText] = React.useState('');

  const messageAlerts = React.useMemo(() => {
    return (notifications ?? []).filter(item => item.notification.type === 'MESSAGE').slice(0, 6);
  }, [notifications]);

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
          ? (dmOtherParticipant ? getUserDisplayName(dmOtherParticipant) : 'Conversation')
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

  const handleOpenMessageAlert = async (conversationId: string, notificationId: string) => {
    await markNotificationAsRead({ notificationId: notificationId as Id<'notifications'> });
    void navigate({
      to: '/inbox',
      search: { conversationId }
    });
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

  return (
    <div className="-m-4 mt-0 flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className={cn('flex-col border-r', 'md:flex md:w-80 lg:w-96', hasActiveChat ? 'hidden' : 'flex w-full')}>
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
        </div>
        {messageAlerts && messageAlerts.length > 0 && (
          <div className="border-b px-3 py-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Bell className="text-muted-foreground size-4" />
              <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                Message Alerts
              </span>
            </div>
            <div className="space-y-2">
              {messageAlerts.map(item => {
                const data = item.notification.data as { conversationId?: Id<'conversations'> } | undefined;
                if (!data?.conversationId) {
                  return null;
                }

                return (
                  <button
                    key={item.notification._id}
                    type="button"
                    className={cn(
                      'hover:bg-muted/60 flex w-full flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors',
                      !item.notification.read && 'bg-primary/5'
                    )}
                    onClick={() => handleOpenMessageAlert(String(data.conversationId), String(item.notification._id))}
                  >
                    <span className="text-sm font-medium">{item.notification.title}</span>
                    <span className="text-muted-foreground line-clamp-2 text-xs">{item.notification.body}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

            <ChatToolbar className="border-t-0">
              <div className="flex w-full items-end gap-2">
                <ChatToolbarTextarea
                  className="bg-secondary/30 hover:bg-secondary/50 focus:bg-secondary/80 focus-visible:ring-primary min-h-11 w-full resize-none rounded-2xl px-4 py-3 text-sm shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:ring-offset-0"
                  rows={1}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onSubmit={handleSend}
                  placeholder="Type your message..."
                />
                <ChatToolbarAddon align="inline-end">
                  <ChatToolbarButton
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    aria-label="Send message"
                    className={cn(
                      'mb-0.5 size-10 shrink-0 rounded-xl transition-colors',
                      messageText.trim()
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    <Send className="size-5" />
                  </ChatToolbarButton>
                </ChatToolbarAddon>
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
