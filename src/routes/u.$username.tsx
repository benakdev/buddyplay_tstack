import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';

import { ProfileHero } from '@/components/profile/ProfileHero';
import { SportPassportGrid } from '@/components/profile/SportPassportGrid';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { api } from '@/convex/_generated/api';
import type { ProfileData } from '@/lib/schema/types';
import { getUserDisplayName } from '@/lib/user-display';

export const Route = createFileRoute('/u/$username')({
  component: PublicUserProfilePage
});

function PublicUserProfilePage() {
  const { username } = Route.useParams();

  const convexUser = useQuery(api.users.getUserByUsername, { username });
  const isUserLoading = convexUser === undefined;

  if (!isUserLoading && !convexUser) {
    return (
      <div className="container max-w-3xl py-16">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Profile not found</EmptyTitle>
            <EmptyDescription>This user does not exist or is no longer available.</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link to="/finder">Back to Finder</Link>
          </Button>
        </Empty>
      </div>
    );
  }

  if (!convexUser) {
    return (
      <div className="container max-w-5xl space-y-12 py-12">
        <ProfileHero user={null} isUserLoading={true} />
      </div>
    );
  }

  const profileData: ProfileData = {
    username: convexUser.username,
    name: getUserDisplayName(convexUser),
    profileUrl: convexUser.profileUrl,
    bio: convexUser.bio,
    location: convexUser.location,
    joinedAt: convexUser._creationTime
  };

  return (
    <div className="container max-w-5xl space-y-12 py-12">
      <ProfileHero user={convexUser} isUserLoading={false} profileData={profileData} />
      <SportPassportGrid userId={convexUser._id} />
    </div>
  );
}
