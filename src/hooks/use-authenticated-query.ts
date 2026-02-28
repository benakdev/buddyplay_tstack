import { useConvexAuth, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReference } from 'convex/server';

/**
 * A wrapper around useQuery that automatically checks authentication state.
 * If the user is not authenticated, the query is skipped, preventing race conditions.
 *
 * @example
 * const user = useAuthenticatedQuery(api.users.getCurrentUser, {});
 */
export function useAuthenticatedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | 'skip'
) {
  const { isAuthenticated } = useConvexAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery(query, (isAuthenticated && args !== 'skip' ? args : 'skip') as any);
}
