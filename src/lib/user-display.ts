type UserPrivacySettings = {
  hideLastName?: boolean;
  hideName?: boolean;
};

type DisplayUser = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  privacySettings?: UserPrivacySettings | null;
};

export function getUserDisplayName(user: DisplayUser | null | undefined): string {
  if (!user) {
    return 'User';
  }

  const username = user.username?.trim();
  const firstName = user.firstName?.trim();
  const lastName = user.lastName?.trim();

  if (user.privacySettings?.hideName) {
    return username || 'User';
  }

  if (user.privacySettings?.hideLastName) {
    if (!firstName) {
      return username || 'User';
    }

    const lastInitial = lastName?.[0] ? ` ${lastName[0]}.` : '';
    return `${firstName}${lastInitial}`.trim();
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || username || 'User';
}

export function getUserInitials(user: DisplayUser | null | undefined) {
  if (!user) {
    return 'U';
  }

  const usernameInitial = user.username?.trim()?.[0]?.toUpperCase();
  const firstInitial = user.firstName?.trim()?.[0]?.toUpperCase();
  const lastInitial = user.lastName?.trim()?.[0]?.toUpperCase();

  if (user.privacySettings?.hideName) {
    return usernameInitial ?? 'U';
  }

  if (user.privacySettings?.hideLastName) {
    return firstInitial ?? usernameInitial ?? 'U';
  }

  const initials = `${firstInitial ?? ''}${lastInitial ?? ''}`;

  if (initials) {
    return initials;
  }

  return usernameInitial ?? 'U';
}
