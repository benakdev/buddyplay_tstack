'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { Check, Clock3, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { CreateGameSheet } from '@/components/dashboard/CreateGameSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export function HostRequestsPanel() {
  const pendingRequests = useQuery(api.requests.getPendingRequests);
  const approveRequest = useMutation(api.requests.approveRequest);
  const rejectRequest = useMutation(api.requests.rejectRequest);
  const [pendingId, setPendingId] = React.useState<Id<'requests'> | null>(null);

  const handleApprove = async (requestId: Id<'requests'>) => {
    setPendingId(requestId);
    try {
      await approveRequest({ requestId });
      toast.success('Request approved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not approve request.';
      toast.error(message);
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async (requestId: Id<'requests'>) => {
    setPendingId(requestId);
    try {
      await rejectRequest({ requestId });
      toast.success('Request declined.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not decline request.';
      toast.error(message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card size="sm" className="app-shell-panel overflow-hidden rounded-3xl">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4" />
          Host Requests
        </CardTitle>
        <CardDescription>Approve or decline players asking to join your games.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        {pendingRequests === undefined ? (
          <div className="text-muted-foreground text-sm">Loading requests…</div>
        ) : pendingRequests.length === 0 ? (
          <div className="app-shell-panel rounded-2xl bg-background/45 p-3 sm:p-4">
            <Empty className="gap-3 rounded-2xl border border-dashed border-border/60 bg-background/20 px-6 py-8">
              <EmptyHeader className="max-w-md">
                <EmptyMedia variant="icon" className="bg-primary/12 text-primary">
                  <Sparkles className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No pending requests yet</EmptyTitle>
                <EmptyDescription>
                  Player join requests will show up here after you create a game and start getting responses.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-none">
                <CreateGameSheet />
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          pendingRequests.map(item => {
            const isPending = pendingId === item.request._id;
            return (
              <div
                key={item.request._id}
                className="app-shell-panel space-y-3 rounded-2xl bg-background/60 p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm leading-snug font-medium">
                    @{item.requester.username} wants to join{' '}
                    <span className="font-semibold">{item.activity.title}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">Review this player from My Games or act here.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleReject(item.request._id)}
                    className="h-10"
                  >
                    <X className="mr-1 size-4" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleApprove(item.request._id)}
                    className="h-10"
                  >
                    <Check className="mr-1 size-4" />
                    Approve
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
