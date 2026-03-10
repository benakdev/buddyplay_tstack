'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  tokenIdentifier?: string;
  username: string;
  profileUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}
export function UserAvatar({ username, profileUrl, className, fallbackClassName }: UserAvatarProps) {
  const initials = username.charAt(0).toUpperCase();

  return (
    <Avatar className={cn('size-8 shrink-0', className)}>
      <AvatarImage src={profileUrl || undefined} alt={username} />
      <AvatarFallback className={cn('bg-muted text-muted-foreground text-xs', fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
