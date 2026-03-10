'use client';

import * as React from 'react';

import { useUser } from '@clerk/tanstack-react-start';
import { MapPin } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { Doc } from '@/convex/_generated/dataModel';
import type { ProfileData } from '@/lib/schema/types';
import { getUserDisplayName, getUserInitials } from '@/lib/user-display';
import { cn } from '@/lib/utils';

import { ProfileSettingsModal } from './ProfileSettingsModal';

interface ProfileHeroProps {
  className?: string;
  user: Doc<'users'> | null;
  isUserLoading: boolean;
  profileData?: ProfileData;
  profileSettingsOpen?: boolean;
  onProfileSettingsOpenChange?: (open: boolean) => void;
}

/**
 * ProfileHero - Top section of Profile page.
 * Shows avatar, name, username, location, bio, and settings button.
 */
export function ProfileHero({
  className,
  user,
  isUserLoading,
  profileData,
  profileSettingsOpen,
  onProfileSettingsOpenChange
}: ProfileHeroProps) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const isReadOnly = !!profileData;

  const displayName = React.useMemo(() => {
    if (profileData) {
      return profileData.name;
    }

    return getUserDisplayName(user);
  }, [profileData, user]);

  const initials = React.useMemo(() => getUserInitials(user ?? { username: profileData?.username }), [profileData, user]);

  // Loading state
  // If reading profileData, we assume it's loaded by the server component effectively immediately relative to client hydration,
  // but if we are in "dashboard mode", we wait for Clerk.
  if ((!isReadOnly && !clerkLoaded) || isUserLoading) {
    return (
      <div className={cn('flex items-center gap-8', className)}>
        <Skeleton className="size-32 rounded-full sm:size-40" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-16 w-full max-w-xl" />
        </div>
      </div>
    );
  }

  // Use profileData values if available, otherwise fall back to user/clerkUser
  const finalUsername = profileData?.username || user?.username;
  const finalLocation = profileData?.location || user?.location;
  const finalBio = profileData?.bio || user?.bio;
  const finalProfileUrl = profileData?.profileUrl || user?.profileUrl || clerkUser?.imageUrl;

  return (
    <div
      className={cn('flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:text-left', className)}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="ring-primary/20 size-32 ring-4 sm:size-40">
          <AvatarImage src={finalProfileUrl} alt={displayName} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-4xl font-medium">{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Info section */}
      <div className="min-w-0 flex-1 pt-2">
        {/* Name and Settings */}
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <h1 className="truncate text-4xl font-bold tracking-tight">{displayName}</h1>
          {!isReadOnly && (
            <ProfileSettingsModal user={user} open={profileSettingsOpen} onOpenChange={onProfileSettingsOpenChange} />
          )}
        </div>

        {/* Username and Location */}
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
          {finalUsername && <span className="font-medium">@{finalUsername}</span>}

          {finalUsername && finalLocation?.city && <span className="text-muted-foreground/40">•</span>}

          {finalLocation?.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {finalLocation.city}
            </span>
          )}
        </div>

        {/* Bio */}
        <div className="mt-6">
          {finalBio ? (
            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed text-pretty">{finalBio}</p>
          ) : (
            <p className="text-muted-foreground/60 italic">
              {isReadOnly ? 'No bio provided.' : 'Add a bio in settings to tell others about yourself.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
