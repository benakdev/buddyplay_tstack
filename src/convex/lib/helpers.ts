import type { GenericDatabaseReader } from 'convex/server';

import type { DataModel, Id } from '../_generated/dataModel';

/**
 * Enriches activities with creator details.
 * Deduplicates creator fetches for efficiency.
 */
export async function enrichActivitiesWithCreators<T extends { creatorId: Id<'users'>; [key: string]: unknown }>(
  db: GenericDatabaseReader<DataModel>,
  activities: T[]
): Promise<Array<{ activity: T; creator: { _id: Id<'users'>; username: string } }>> {
  const creatorIds = Array.from(new Set(activities.map(activity => activity.creatorId)));
  const creators = await Promise.all(creatorIds.map(id => db.get('users', id)));
  const creatorById = new Map(creators.filter(Boolean).map(creator => [creator!._id, creator!] as const));

  const results: Array<{ activity: T; creator: { _id: Id<'users'>; username: string } }> = [];

  for (const activity of activities) {
    const creator = creatorById.get(activity.creatorId);
    if (creator) {
      results.push({
        activity,
        creator: {
          _id: creator._id,
          username: creator.username
        }
      });
    }
  }

  return results;
}
