import { auth, clerkClient } from '@clerk/tanstack-react-start/server';
import { createFileRoute } from '@tanstack/react-router';
import { ConvexHttpClient } from 'convex/browser';

import { api, internal } from '@/convex/_generated/api';

function getConvexUrl() {
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not configured.');
  }

  return convexUrl;
}

function getConvexAdminKey() {
  const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
  if (!convexAdminKey) {
    throw new Error('CONVEX_ADMIN_KEY is not configured.');
  }

  return convexAdminKey;
}

type AdminConvexHttpClient = ConvexHttpClient & {
  setAdminAuth: (token: string) => void;
  mutation: (mutationRef: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

export const Route = createFileRoute('/api/account/delete')({
  server: {
    handlers: {
      POST: async () => {
        const authState = await auth();
        if (!authState.userId) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const convexToken = await authState.getToken({ template: 'convex' });
        if (!convexToken) {
          return Response.json({ error: 'Unable to authorize account deletion.' }, { status: 401 });
        }

        let convexUrl: string;
        try {
          convexUrl = getConvexUrl();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'VITE_CONVEX_URL is not configured.';
          return Response.json({ error: message }, { status: 500 });
        }

        const deletedAt = Date.now();
        const userClient = new ConvexHttpClient(convexUrl);
        userClient.setAuth(convexToken);

        const currentUser = await userClient.query(api.users.getCurrentUser, {});
        if (!currentUser) {
          return Response.json({ error: 'User not found.' }, { status: 404 });
        }

        let convexAdminKey: string;
        try {
          convexAdminKey = getConvexAdminKey();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'CONVEX_ADMIN_KEY is not configured.';
          return Response.json({ error: message }, { status: 500 });
        }

        try {
          await clerkClient().users.deleteUser(authState.userId);
        } catch (error) {
          console.error('Failed to delete Clerk account:', error);
          return Response.json({ error: 'Failed to delete Clerk account.' }, { status: 500 });
        }

        const adminClient = new ConvexHttpClient(convexUrl) as AdminConvexHttpClient;
        adminClient.setAdminAuth(convexAdminKey);

        try {
          // Convex supports calling internal functions with admin auth, but the
          // published TS surface only types public functions here.
          await adminClient.mutation(internal.users.deleteUserById, {
            userId: currentUser._id,
            deletedAt
          });
        } catch (error) {
          console.error('Failed to finalize account deletion in Convex:', {
            error,
            userId: currentUser._id,
            deletedAt
          });
          return Response.json({ error: 'Clerk account deleted, but Convex cleanup failed.' }, { status: 500 });
        }

        return Response.json({ ok: true });
      }
    }
  }
});
