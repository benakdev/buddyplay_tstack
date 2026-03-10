'use client';

import * as React from 'react';

import { useAuth, useClerk, useUser } from '@clerk/tanstack-react-start';
import { useMutation, useQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Loader2, Mail, Monitor, Shield, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import AvatarUpload from '@/components/profile/AvatarUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';
import { api } from '@/convex/_generated/api';
import { syncClerkIdentityToConvex } from '@/lib/clerk-profile-sync';
import { getUserInitials } from '@/lib/user-display';

type AccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogSection = 'account' | 'security';

type SessionRecord = Record<string, unknown>;
type ExternalAccountRecord = Record<string, unknown>;

const sections: Array<{
  id: DialogSection;
  label: string;
  description: string;
  icon: typeof UserRound;
}> = [
  {
    id: 'account',
    label: 'Account',
    description: 'Profile details and photo',
    icon: UserRound
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Sessions and linked sign-in',
    icon: Shield
  }
];

function getStringValue(record: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!record) {
    return null;
  }

  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getRecordValue(
  record: Record<string, unknown> | null | undefined,
  key: string
): Record<string, unknown> | null {
  if (!record) {
    return null;
  }

  const value = record[key];
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function getDateValue(record: Record<string, unknown> | null | undefined, key: string): Date | null {
  if (!record) {
    return null;
  }

  const value = record[key];
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatProviderName(provider: string | null): string {
  if (!provider) {
    return 'Connected account';
  }

  return provider
    .replace(/^oauth_/, '')
    .split(/[_-]/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getSessionSummary(session: SessionRecord) {
  const latestActivity =
    getRecordValue(session, 'latestActivity') ??
    getRecordValue(getRecordValue(session, 'lastActiveToken'), 'device') ??
    getRecordValue(getRecordValue(session, 'lastActiveToken'), 'userAgent');

  const browserName =
    getStringValue(latestActivity, 'browserName') ??
    getStringValue(session, 'browserName') ??
    getStringValue(getRecordValue(session, 'lastActiveToken'), 'browserName');
  const deviceType =
    getStringValue(latestActivity, 'deviceType') ??
    getStringValue(session, 'deviceType') ??
    getStringValue(getRecordValue(session, 'lastActiveToken'), 'deviceType');
  const ipAddress =
    getStringValue(latestActivity, 'ipAddress') ??
    getStringValue(session, 'lastActiveToken') ??
    getStringValue(session, 'lastActiveIpAddress');
  const city = getStringValue(latestActivity, 'city') ?? getStringValue(session, 'city');
  const country = getStringValue(latestActivity, 'country') ?? getStringValue(session, 'country');
  const lastActiveAt =
    getDateValue(session, 'lastActiveAt') ??
    getDateValue(latestActivity, 'timestamp') ??
    getDateValue(getRecordValue(session, 'lastActiveToken'), 'updatedAt');

  const title = [deviceType, browserName].filter(Boolean).join(' · ') || browserName || deviceType || 'Active session';
  const location = [city, country].filter(Boolean).join(', ');

  return {
    id: getStringValue(session, 'id') ?? crypto.randomUUID(),
    title,
    browserName,
    ipAddress,
    location,
    lastActiveAt
  };
}

function getExternalAccountSummary(account: ExternalAccountRecord) {
  const verification = getRecordValue(account, 'verification');
  const provider =
    getStringValue(account, 'provider') ??
    getStringValue(account, 'strategy') ??
    getStringValue(account, 'providerName');
  const identifier =
    getStringValue(account, 'emailAddress') ??
    getStringValue(account, 'username') ??
    getStringValue(account, 'providerUserId');

  return {
    id: getStringValue(account, 'id') ?? crypto.randomUUID(),
    providerLabel: formatProviderName(provider),
    identifier,
    imageUrl: getStringValue(account, 'imageUrl'),
    status: getStringValue(verification, 'status') ?? 'connected'
  };
}

function SectionButton({
  active,
  icon: Icon,
  label,
  description,
  onClick
}: {
  active: boolean;
  icon: typeof UserRound;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton size="lg" isActive={active} onClick={onClick} className="h-auto items-start py-3">
        <Icon className="mt-0.5 size-4" />
        <div className="grid min-w-0 flex-1 gap-0.5 text-left">
          <span className="truncate font-medium">{label}</span>
          <span className="text-sidebar-foreground/70 truncate text-xs">{description}</span>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const { sessionId } = useAuth();
  const clerk = useClerk();
  const { user, isLoaded } = useUser();
  const convexUser = useQuery(api.users.getCurrentUser, {});
  const syncClerkProfile = useMutation(api.users.syncClerkProfile);

  const [activeSection, setActiveSection] = React.useState<DialogSection>('account');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [sessionsError, setSessionsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setActiveSection('account');
    setAvatarFile(null);
    setFirstName(user?.firstName ?? convexUser?.firstName ?? '');
    setLastName(user?.lastName ?? convexUser?.lastName ?? '');
  }, [open, user?.firstName, user?.lastName, convexUser?.firstName, convexUser?.lastName]);

  React.useEffect(() => {
    if (!open || activeSection !== 'security' || !user) {
      return;
    }

    let cancelled = false;

    const loadSessions = async () => {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        const nextSessions = await user.getSessions();
        if (!cancelled) {
          setSessions(nextSessions as unknown as SessionRecord[]);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
        if (!cancelled) {
          setSessionsError('Unable to load active sessions right now.');
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [open, activeSection, user]);

  const emailAddress = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayedFirstName = user?.firstName ?? convexUser?.firstName ?? '';
  const displayedLastName = user?.lastName ?? convexUser?.lastName ?? '';
  const initials = getUserInitials({
    firstName: user?.firstName ?? convexUser?.firstName,
    lastName: user?.lastName ?? convexUser?.lastName,
    username: convexUser?.username
  });

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const hasNameChanges = trimmedFirstName !== displayedFirstName || trimmedLastName !== displayedLastName;
  const isAccountDirty = hasNameChanges || avatarFile !== null;
  const canSave = isLoaded && !!user && trimmedFirstName.length > 0 && trimmedLastName.length > 0 && isAccountDirty;

  const handleSave = async () => {
    if (!user) {
      return;
    }

    if (!trimmedFirstName || !trimmedLastName) {
      toast.error('First name and last name are required.');
      return;
    }

    setIsSaving(true);

    try {
      await syncClerkIdentityToConvex({
        clerkUser: user,
        syncClerkProfile,
        firstName: hasNameChanges ? trimmedFirstName : undefined,
        lastName: hasNameChanges ? trimmedLastName : undefined,
        avatarFile
      });

      toast.success('Account updated.');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update account:', error);
      toast.error('Failed to update your account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST'
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to delete your account.');
      }

      toast.success('Your account has been deleted.');
      await clerk.signOut({ redirectUrl: '/' });
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete your account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const normalizedSessions = React.useMemo(() => sessions.map(getSessionSummary), [sessions]);
  const normalizedExternalAccounts = React.useMemo(
    () => ((user?.externalAccounts ?? []) as unknown as ExternalAccountRecord[]).map(getExternalAccountSummary),
    [user?.externalAccounts]
  );

  return (
    <Dialog open={open} onOpenChange={nextOpen => !isSaving && !isDeleting && onOpenChange(nextOpen)}>
      <DialogContent className="h-[min(90vh,760px)] overflow-hidden p-0 sm:max-w-5xl" showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>Manage your BuddyPlay account details and security settings.</DialogDescription>
        </DialogHeader>

        <SidebarProvider className="h-full min-h-0">
          <div className="flex h-full min-h-0 flex-col md:flex-row">
            <Sidebar
              collapsible="none"
              className="border-border bg-sidebar/50 w-full border-b md:w-72 md:border-r md:border-b-0"
            >
              <SidebarHeader className="border-sidebar-border gap-4 border-b p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="border-sidebar-border/80 size-12 border">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? 'Account'} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">{user?.fullName ?? 'Loading account'}</span>
                    <span className="text-sidebar-foreground/70 truncate text-xs">
                      {emailAddress || 'No email address'}
                    </span>
                  </div>
                </div>
                <div className="grid gap-1">
                  <h2 className="text-xl font-semibold tracking-tight">Account</h2>
                  <p className="text-sidebar-foreground/70 text-sm">Your profile and security settings</p>
                </div>
              </SidebarHeader>

              <SidebarContent className="p-2">
                <SidebarMenu>
                  {sections.map(section => (
                    <SectionButton
                      key={section.id}
                      active={section.id === activeSection}
                      icon={section.icon}
                      label={section.label}
                      description={section.description}
                      onClick={() => setActiveSection(section.id)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarContent>


            </Sidebar>

            <div className="bg-background min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="flex min-h-full flex-col p-6 md:p-8">
                  {activeSection === 'account' ? (
                    <div className="flex flex-1 flex-col gap-8">
                      <div className="grid gap-2">
                        <h3 className="text-2xl font-semibold tracking-tight">Account</h3>
                        <p className="text-muted-foreground max-w-2xl text-sm">
                          Update your profile photo and name. Changes appear everywhere across BuddyPlay.
                        </p>
                      </div>

                      <div className="border-border/70 bg-card/40 grid gap-6 rounded-3xl border p-5 md:grid-cols-[220px_1fr]">
                        <div className="flex flex-col items-center justify-start gap-4">
                          <AvatarUpload
                            defaultAvatar={user?.imageUrl}
                            onFileChange={file => {
                              if (file?.file instanceof File) {
                                setAvatarFile(file.file);
                                return;
                              }

                              setAvatarFile(null);
                            }}
                          />
                          <p className="text-muted-foreground text-center text-xs leading-relaxed">
                            Recommended square image, up to 2MB.
                          </p>
                        </div>

                        <div className="grid gap-5">
                          <div className="grid gap-2">
                            <label htmlFor="account-first-name" className="text-sm font-medium">
                              First name
                            </label>
                            <Input
                              id="account-first-name"
                              value={firstName}
                              onChange={event => setFirstName(event.target.value)}
                              placeholder="First name"
                              disabled={!isLoaded || isSaving}
                            />
                          </div>

                          <div className="grid gap-2">
                            <label htmlFor="account-last-name" className="text-sm font-medium">
                              Last name
                            </label>
                            <Input
                              id="account-last-name"
                              value={lastName}
                              onChange={event => setLastName(event.target.value)}
                              placeholder="Last name"
                              disabled={!isLoaded || isSaving}
                            />
                          </div>

                          <div className="grid gap-2">
                            <label htmlFor="account-email" className="text-sm font-medium">
                              Email address
                            </label>
                            <div className="text-muted-foreground border-border bg-muted/30 flex h-9 items-center gap-2 rounded-4xl border px-3 text-sm">
                              <Mail className="size-4" />
                              <span className="truncate">{emailAddress || 'No primary email address'}</span>
                            </div>
                          </div>


                        </div>
                      </div>

                      <div className="border-border mt-auto flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                          Cancel
                        </Button>
                        <Button onClick={() => void handleSave()} disabled={!canSave || isSaving}>
                          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                          Save changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col gap-8">
                      <div className="grid gap-2">
                        <h3 className="text-2xl font-semibold tracking-tight">Security</h3>
                        <p className="text-muted-foreground max-w-2xl text-sm">
                          See where you're signed in, manage connected accounts, or delete your account.
                        </p>
                      </div>

                      <div className="border-border/70 bg-card/40 grid gap-4 rounded-3xl border p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-medium">Active devices</h4>
                            <p className="text-muted-foreground text-sm">
                              Devices currently signed in to your account.
                            </p>
                          </div>
                          {sessionsLoading ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
                        </div>
                        <Separator />
                        <div className="grid gap-3">
                          {sessionsError ? (
                            <p className="text-destructive text-sm">{sessionsError}</p>
                          ) : normalizedSessions.length > 0 ? (
                            normalizedSessions.map(session => {
                              const isCurrentSession = session.id === sessionId;

                              return (
                                <div
                                  key={session.id}
                                  className="border-border/70 bg-background/70 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="bg-muted flex size-10 items-center justify-center rounded-2xl">
                                      <Monitor className="size-4" />
                                    </div>
                                    <div className="grid gap-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">{session.title}</span>
                                        {isCurrentSession ? (
                                          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                                            This device
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-muted-foreground grid gap-1 text-sm">
                                        {session.ipAddress ? <span>{session.ipAddress}</span> : null}
                                        {session.location ? <span>{session.location}</span> : null}
                                        {session.lastActiveAt ? (
                                          <span>{formatDistanceToNow(session.lastActiveAt, { addSuffix: true })}</span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-muted-foreground text-sm">No active session details are available.</p>
                          )}
                        </div>
                      </div>

                      <div className="border-border/70 bg-card/40 grid gap-4 rounded-3xl border p-5">
                        <div>
                          <h4 className="font-medium">Connected accounts</h4>
                          <p className="text-muted-foreground text-sm">
                            Sign-in methods linked to your account.
                          </p>
                        </div>
                        <Separator />
                        <div className="grid gap-3">
                          {normalizedExternalAccounts.length > 0 ? (
                            normalizedExternalAccounts.map(account => (
                              <div
                                key={account.id}
                                className="border-border/70 bg-background/70 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar className="border-border/70 size-10 rounded-full border">
                                    <AvatarImage src={account.imageUrl ?? undefined} alt={account.providerLabel} />
                                    <AvatarFallback className="text-xs">
                                      {account.providerLabel.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="grid min-w-0 gap-0.5">
                                    <span className="font-medium">{account.providerLabel}</span>
                                    {account.identifier ? (
                                      <span className="text-muted-foreground truncate text-sm">
                                        {account.identifier}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <span className="text-muted-foreground text-sm capitalize">{account.status}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground text-sm">
                              No external accounts are currently connected.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-destructive/30 bg-destructive/5 grid gap-4 rounded-3xl border p-5">
                        <div>
                          <h4 className="text-destructive font-medium">Delete account</h4>
                          <p className="text-muted-foreground text-sm">
                            Permanently delete your account and all associated data.
                          </p>
                        </div>
                        <div className="border-destructive/20 bg-background/70 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm leading-relaxed">
                            You'll immediately lose access to your account. This action cannot be undone.
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={isDeleting}>
                                Delete account
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                  <AlertTriangle className="size-7" />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Your account and all your data will be permanently deleted. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  disabled={isDeleting}
                                  onClick={() => void handleDeleteAccount()}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4" />
                                  )}
                                  Delete account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
