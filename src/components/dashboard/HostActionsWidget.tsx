'use client';

import { useQuery } from 'convex/react';
import { Clock3 } from 'lucide-react';

import { api } from '@/convex/_generated/api';

import { HostRequestsPanel } from './HostRequestsPanel';

export function HostActionsWidget() {
  const pendingRequests = useQuery(api.requests.getPendingRequests);

  const pendingCount = pendingRequests?.length ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <Clock3 className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Pending Requests</span>
        {pendingCount > 0 && (
          <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
            {pendingCount}
          </span>
        )}
      </div>
      <HostRequestsPanel />
    </section>
  );
}
