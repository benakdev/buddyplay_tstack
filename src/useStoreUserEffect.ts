'use client';

import { useEffect, useState } from 'react';

import { useUser } from '@clerk/tanstack-react-start';
import { useConvexAuth, useMutation } from 'convex/react';

import { api } from './convex/_generated/api';
import type { Id } from './convex/_generated/dataModel';

export function useStoreUserEffect() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const storeUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    async function createUser() {
      const userDoc = await storeUser({});
      setUserId(userDoc._id);
    }

    void createUser();
    return () => setUserId(null);
  }, [isAuthenticated, storeUser, user?.id]);

  return {
    isLoading: isLoading || (isAuthenticated && userId === null),
    isAuthenticated: isAuthenticated && userId !== null
  };
}
