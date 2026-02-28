'use client';

import * as React from 'react';

import { useMutation, useQuery } from 'convex/react';
import { Bell, MapPin, Signal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Doc<'alerts'>;
  className?: string;
}

/**
 * AlertCard - Displays a single passport alert with toggle.
 * Read-only information; user can only toggle on/off.
 */
export function AlertCard({ alert, className }: AlertCardProps) {
  const toggleAlert = useMutation(api.alerts.toggleAlert);
  const clubs = useQuery(api.clubs.listClubs, { sport: alert.sport });
  const [isPending, setIsPending] = React.useState(false);

  const club = clubs?.find(c => c._id === alert.filters.clubId);
  const levelLabel = `Level ${alert.filters.levelMin?.toFixed(1) ?? '?'} – ${alert.filters.levelMax?.toFixed(1) ?? '?'}`;

  const handleToggle = async () => {
    setIsPending(true);
    try {
      await toggleAlert({ alertId: alert._id });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card
      className={cn(
        'relative min-w-65 shrink-0 overflow-hidden transition-all',
        !alert.active && 'opacity-60',
        className
      )}
    >
      {/* Subtle accent gradient */}
      <div className="from-primary/10 pointer-events-none absolute inset-0 bg-linear-to-br to-transparent" />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 text-primary flex size-10 items-center justify-center rounded-lg">
              <Bell className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{alert.sport} Alert</h3>
              {alert.isPassport && <p className="text-muted-foreground text-xs">From Passport</p>}
            </div>
          </div>
          <Switch
            checked={alert.active}
            onCheckedChange={handleToggle}
            disabled={isPending}
            aria-label={`Toggle ${alert.sport} alert`}
          />
        </div>
      </CardHeader>

      <CardContent className="relative space-y-2 pt-0">
        {/* Level range */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Signal className="size-4 shrink-0" />
          <Badge variant="secondary" className="text-xs font-medium">
            {levelLabel}
          </Badge>
        </div>

        {/* Club/City */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <MapPin className="size-4 shrink-0" />
          <span>{club?.name ?? alert.filters.city}</span>
        </div>
      </CardContent>
    </Card>
  );
}
