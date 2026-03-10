'use client';

import * as React from 'react';

import { useUser } from '@clerk/tanstack-react-start';
import { useForm } from '@tanstack/react-form';
import { useMutation } from 'convex/react';
import { Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { SelectField, SwitchField, TextField, TextareaField, ToggleGroupField } from '@/components/form';
import { Button } from '@/components/ui/button';
import { DrawerClose, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { ResponsiveFormContainer } from '@/components/ui/responsive-form-container';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { genderSchema, handSchema, usernameSchema } from '@/convex/lib/validation/sharedSchemas';
import { useIsMobile } from '@/hooks/use-mobile';
import { syncClerkIdentityToConvex } from '@/lib/clerk-profile-sync';
import { cn } from '@/lib/utils';

import AvatarUpload from './AvatarUpload';

interface ProfileSettingsModalProps {
  trigger?: React.ReactNode;
  user: Doc<'users'> | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Client-side schema for form validation (derived from Convex schemas)
const profileFormSchema = z.object({
  username: usernameSchema,
  gender: genderSchema,
  age: z
    .string()
    .refine(value => value === '' || (/^\d+$/.test(value) && Number(value) >= 13 && Number(value) <= 120), {
      message: 'Age must be between 13 and 120.'
    }),
  dominantHand: handSchema.optional().or(z.literal('')),
  bio: z.string().optional(),
  hideLastName: z.boolean(),
  hideName: z.boolean()
});

// Type derived from schema
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileSettingsFormContentProps {
  user: Doc<'users'> | null;
  onClose: () => void;
  isMobile: boolean;
}

// Inner component that gets remounted when key changes
function ProfileSettingsFormContent({ user, onClose, isMobile }: ProfileSettingsFormContentProps) {
  const { user: clerkUser } = useUser();
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const updateUser = useMutation(api.users.updateUser);
  const syncClerkProfile = useMutation(api.users.syncClerkProfile);

  const form = useForm({
    defaultValues: {
      username: user?.username || '',
      gender: user?.gender === 'Male' || user?.gender === 'Female' ? user.gender : 'Male',
      age: user?.age ? String(user.age) : '',
      dominantHand: user?.dominantHand || '',
      bio: user?.bio || '',
      hideLastName: user?.privacySettings?.hideLastName || false,
      hideName: user?.privacySettings?.hideName || false
    } as ProfileFormValues,
    validators: {
      onChange: profileFormSchema
    },
    onSubmit: async ({ value }) => {
      const username = value.username.trim();
      const bio = value.bio?.trim();
      const parsedAge = value.age ? Number(value.age) : undefined;
      const payload = {
        username: username || undefined,
        gender: value.gender,
        age: parsedAge,
        dominantHand: value.dominantHand ? (value.dominantHand as 'Left' | 'Right') : undefined,
        bio: bio || undefined,
        privacySettings: {
          hideLastName: value.hideLastName,
          hideName: value.hideName
        }
      };

      try {
        if (avatarFile && clerkUser) {
          await syncClerkIdentityToConvex({
            clerkUser,
            syncClerkProfile,
            avatarFile
          });
        }

        await updateUser(payload);
        onClose();
      } catch (error) {
        console.error('Failed to update profile:', error);
        toast.error('Failed to update profile. Please try again.');
      }
    }
  });

  const formContent = (
    <form
      onSubmit={async e => {
        e.preventDefault();
        await form.handleSubmit();
      }}
      className={cn('grid gap-6', isMobile ? 'px-4' : 'p-6')}
    >
      {/* Identity Section */}
      <div className="space-y-4">
        <Label className="text-base">Public Profile</Label>

        <AvatarUpload
          defaultAvatar={clerkUser?.imageUrl}
          onFileChange={file => {
            if (file?.file instanceof File) {
              setAvatarFile(file.file);
            } else {
              setAvatarFile(null);
            }
          }}
          className="mb-4"
        />

        {/* Username */}
        <form.Field name="username">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <TextField
                label="Username"
                id="username"
                value={field.state.value}
                onChange={value => field.handleChange(value)}
                onBlur={field.handleBlur}
                placeholder="@username"
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>

        {/* Gender */}
        <form.Field name="gender">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <SelectField
                label="Gender"
                id="gender"
                value={field.state.value ?? ''}
                onChange={value => field.handleChange(value as typeof field.state.value)}
                onBlur={field.handleBlur}
                placeholder="Select gender"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' }
                ]}
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>

        <form.Field name="age">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <TextField
                label="Age"
                id="age"
                type="number"
                min={13}
                max={120}
                inputMode="numeric"
                value={field.state.value ?? ''}
                onChange={value => field.handleChange(value)}
                onBlur={field.handleBlur}
                placeholder="Optional"
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>

        <form.Field name="dominantHand">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <ToggleGroupField
                label="Dominant Hand"
                id="dominantHand"
                value={field.state.value ?? ''}
                onChange={value => field.handleChange(value as typeof field.state.value)}
                onBlur={field.handleBlur}
                options={[
                  { value: 'Left', label: 'Left Handed' },
                  { value: 'Right', label: 'Right Handed' }
                ]}
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>

        {/* Bio */}
        <form.Field name="bio">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <TextareaField
                label="Bio"
                id="bio"
                value={field.state.value ?? ''}
                onChange={value => field.handleChange(value)}
                onBlur={field.handleBlur}
                placeholder="Share your play style, experience, or what you're looking for..."
                rows={3}
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>
      </div>

      {/* Privacy Settings */}
      <div className="space-y-4">
        <Label className="text-base">Privacy</Label>

        <form.Field name="hideLastName">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <SwitchField
                label="Abbreviate Last Name"
                id="hideLastName"
                checked={field.state.value}
                onChange={value => field.handleChange(value)}
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>

        <form.Field name="hideName">
          {field => {
            const error = field.state.meta.errors[0];
            return (
              <SwitchField
                label="Display as Username"
                id="hideName"
                checked={field.state.value}
                onChange={value => field.handleChange(value)}
                error={typeof error === 'string' ? error : error?.message}
                invalid={field.state.meta.errors.length > 0}
              />
            );
          }}
        </form.Field>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <>
        <DrawerHeader className="text-left">
          <DrawerTitle>Profile Settings</DrawerTitle>
          <DrawerDescription>Update your profile information and privacy preferences.</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">{formContent}</div>
        <DrawerFooter className="pt-2">
          <div className="flex w-full gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </DrawerClose>
            <Button onClick={() => form.handleSubmit()} className="flex-1">
              <Save className="mr-2 size-4" />
              Save
            </Button>
          </div>
        </DrawerFooter>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Profile Settings</SheetTitle>
        <SheetDescription>Update your profile information and privacy preferences.</SheetDescription>
      </SheetHeader>
      {formContent}
      <SheetFooter className="flex flex-col gap-2 px-6 pb-6 sm:justify-normal">
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => form.handleSubmit()} className="flex-1">
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

/**
 * ProfileSettingsModal - Responsive settings modal.
 * Sheet on desktop (≥768px), Drawer on mobile.
 *
 * Uses a key prop to force remount when the modal opens,
 * eliminating the need for useEffect with form.reset()
 */
export function ProfileSettingsModal({ trigger, user, open: openProp, onOpenChange }: ProfileSettingsModalProps) {
  const [open, setOpen] = React.useState(false);
  const [openCount, setOpenCount] = React.useState(0);
  const isMobile = useIsMobile();
  const isControlled = openProp !== undefined;
  const actualOpen = isControlled ? openProp : open;
  const wasOpenRef = React.useRef(false);

  const defaultTrigger = (
    <Button variant="ghost" size="icon" aria-label="Profile settings">
      <Settings className="size-5" />
    </Button>
  );

  React.useEffect(() => {
    if (!isControlled) return;
    if (openProp && !wasOpenRef.current) {
      setOpenCount(prev => prev + 1);
    }
    wasOpenRef.current = !!openProp;
  }, [isControlled, openProp]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isControlled) {
      if (isOpen) {
        setOpenCount(prev => prev + 1);
      }
      setOpen(isOpen);
    }
    onOpenChange?.(isOpen);
  };

  // Generate key based on user id and open count
  const formKey = `${user?._id ?? 'new'}-${openCount}`;

  return (
    <ResponsiveFormContainer
      open={actualOpen}
      onOpenChange={handleOpenChange}
      trigger={trigger || defaultTrigger}
      drawerContentProps={{ className: 'max-h-[90vh]' }}
      sheetContentProps={{ className: 'overflow-y-auto' }}
    >
      <ProfileSettingsFormContent
        key={formKey}
        user={user}
        onClose={() => handleOpenChange(false)}
        isMobile={isMobile}
      />
    </ResponsiveFormContainer>
  );
}
