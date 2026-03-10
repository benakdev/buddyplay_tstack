type ClerkProfileUpdate = {
  firstName?: string;
  lastName?: string;
};

type ClerkProfileSyncUser = {
  update: (params: ClerkProfileUpdate) => Promise<unknown>;
  setProfileImage: (params: { file: File }) => Promise<unknown>;
  reload: () => Promise<{
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
  }>;
};

type SyncClerkProfileMutation = (args: {
  firstName?: string;
  lastName?: string;
  profileUrl?: string;
}) => Promise<unknown>;

type SyncClerkIdentityParams = {
  clerkUser: ClerkProfileSyncUser;
  syncClerkProfile: SyncClerkProfileMutation;
  firstName?: string;
  lastName?: string;
  avatarFile?: File | null;
};

export async function syncClerkIdentityToConvex({
  clerkUser,
  syncClerkProfile,
  firstName,
  lastName,
  avatarFile
}: SyncClerkIdentityParams) {
  const shouldUpdateName = firstName !== undefined || lastName !== undefined;
  const shouldUpdateAvatar = avatarFile instanceof File;

  if (!shouldUpdateName && !shouldUpdateAvatar) {
    return;
  }

  if (shouldUpdateName) {
    await clerkUser.update({
      firstName,
      lastName
    });
  }

  if (shouldUpdateAvatar) {
    await clerkUser.setProfileImage({ file: avatarFile });
  }

  const reloadedUser = await clerkUser.reload();

  await syncClerkProfile({
    firstName: reloadedUser.firstName ?? undefined,
    lastName: reloadedUser.lastName ?? undefined,
    profileUrl: reloadedUser.imageUrl ?? undefined
  });
}
