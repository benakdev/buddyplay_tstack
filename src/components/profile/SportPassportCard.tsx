'use client';

import * as React from 'react';

import { useQuery } from 'convex/react';
import { ArrowLeftRight, Calendar, MapPin, Users } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Availability, Sport } from '@/lib/schema/types';
import { getAvailabilitySummary, getSkillLabel } from '@/lib/schema/ui-helpers';
import { cn } from '@/lib/utils';

import { PassportEditModal } from './PassportEditModal';

// Type for sport profile from Convex
export interface SportProfile {
  _id: Id<'userSportProfiles'>;
  sport: Sport;
  skillLevel: number;
  isActive: boolean;
  homeClubId?: Id<'clubs'>;
  playtomicRating?: number;
  wprRating?: number;
  attributes?: {
    hand?: 'Left' | 'Right';
    courtSide?: 'Left' | 'Right' | 'Both';
  };
  preferredGender?: 'Male' | 'Female' | 'Any';
  availability?: Availability;
}

interface SportPassportCardProps {
  profile: SportProfile;
  className?: string;
  isEditable?: boolean;
}

/**
 * SportPassportCard - Summary card for an existing sport passport.
 * Clicking opens the PassportEditModal in edit mode if isEditable is true.
 */
export function SportPassportCard({ profile, className, isEditable = true }: SportPassportCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const clubs = useQuery(api.clubs.listClubs, { sport: profile.sport });

  const skillLabel = profile.sport === 'Pickleball' ? getSkillLabel(profile.sport, profile.skillLevel) : null;
  const handLabel = profile.attributes?.hand ? `${profile.attributes.hand}-Handed`.toUpperCase() : null;
  const courtSideLabel = profile.attributes?.courtSide ? `${profile.attributes.courtSide} Side` : null;
  const playtomicLabel = profile.playtomicRating !== undefined ? profile.playtomicRating.toFixed(1) : null;
  const wprLabel = profile.wprRating !== undefined ? profile.wprRating.toFixed(1) : null;
  const ratingSummary =
    profile.sport === 'Padel'
      ? [playtomicLabel && `Playtomic ${playtomicLabel}`, wprLabel && `WPR ${wprLabel}`].filter(Boolean).join(' • ')
      : skillLabel;
  const headlineRating =
    profile.sport === 'Padel' ? (playtomicLabel ?? wprLabel ?? '--') : profile.skillLevel.toFixed(1);
  const homeClub = clubs?.find(club => club._id === profile.homeClubId);
  const preferredGenderLabel = React.useMemo(() => {
    if (!profile.preferredGender || profile.preferredGender === 'Any') return 'Open to play with everyone';
    if (profile.preferredGender === 'Male') return 'Open to play with men';
    if (profile.preferredGender === 'Female') return 'Open to play with women';
    return 'Open to play with everyone';
  }, [profile.preferredGender]);

  // Generate availability summary
  const availabilitySummary = React.useMemo(() => {
    if (!profile.availability) return null;
    return getAvailabilitySummary(profile.availability);
  }, [profile.availability]);

  const handleCardClick = () => {
    if (isEditable) {
      setEditOpen(true);
    }
  };

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden transition-all',
          isEditable ? 'hover:border-primary/50 group cursor-pointer hover:shadow-md' : 'cursor-default',
          className
        )}
        onClick={handleCardClick}
      >
        {/* Subtle gradient overlay on hover - only if editable */}
        {isEditable && (
          <div className="from-primary/5 absolute inset-0 bg-linear-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        )}

        <CardHeader className="relative pb-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">{profile.sport}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {handLabel && <p className="text-muted-foreground text-xs tracking-wide">{handLabel}</p>}
                {ratingSummary && <p className="text-muted-foreground text-xs tracking-wide">{ratingSummary}</p>}
              </div>
            </div>
            <span className="text-primary text-2xl font-bold">{headlineRating}</span>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-2">
          {/* Availability summary */}
          {availabilitySummary && (
            <div className="text-muted-foreground flex items-start gap-2 text-sm">
              <Calendar className="mt-0.5 size-4 shrink-0" />
              <span className="line-clamp-2">{availabilitySummary}</span>
            </div>
          )}

          {/* Court Side */}
          {courtSideLabel && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <ArrowLeftRight className="size-4 shrink-0" />
              <span>{courtSideLabel}</span>
            </div>
          )}

          {/* Preferred Gender */}
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Users className="size-4 shrink-0" />
            <span>{preferredGenderLabel}</span>
          </div>

          {/* Home club */}
          {homeClub && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <MapPin className="size-4 shrink-0" />
              <span>{homeClub.name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit modal - only render if editable */}
      {isEditable && (
        <PassportEditModal
          open={editOpen}
          onOpenChange={setEditOpen}
          sport={profile.sport}
          mode="edit"
          profileId={profile._id}
          initialData={{
            skillLevel: profile.skillLevel,
            homeClubId: profile.homeClubId,
            playtomicRating: profile.playtomicRating,
            wprRating: profile.wprRating,
            courtSide: profile.attributes?.courtSide,
            preferredGender: profile.preferredGender ?? 'Any',
            availability: profile.availability
          }}
        />
      )}
    </>
  );
}
