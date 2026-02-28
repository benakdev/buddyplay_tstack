'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { Check, Clock3, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4" />
          Host Requests
        </CardTitle>
        <CardDescription>Approve or decline players asking to join your games.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {pendingRequests === undefined ? (
          <div className="text-muted-foreground text-sm">Loading requests…</div>
        ) : pendingRequests.length === 0 ? (
          <div className="text-muted-foreground text-sm">No pending requests right now.</div>
        ) : (
          pendingRequests.map(item => {
            const isPending = pendingId === item.request._id;
            return (
              <div key={item.request._id} className="bg-muted/40 space-y-2 rounded-xl border p-3">
                <p className="text-sm font-medium">
                  @{item.requester.username} wants to join <span className="font-semibold">{item.activity.title}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleReject(item.request._id)}
                  >
                    <X className="mr-1 size-4" />
                    Decline
                  </Button>
                  <Button size="sm" disabled={isPending} onClick={() => handleApprove(item.request._id)}>
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
