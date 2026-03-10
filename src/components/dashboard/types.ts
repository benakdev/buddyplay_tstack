import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { Sport } from '@/lib/schema/types';

export const SPORT_OPTIONS: Array<Sport> = ['Padel', 'Pickleball'];

export type SportProfileDoc = Doc<'userSportProfiles'>;
export type ClubDoc = Doc<'clubs'>;

export type MatchingPlayer = {
  profile: SportProfileDoc;
  user: {
    _id: Id<'users'>;
    username: string;
  };
  sameClub: boolean;
  matchPercentage: number | null;
};

export type ActivityWithCreator = {
  activity: Doc<'activities'>;
  creator: {
    _id: Id<'users'>;
    username: string;
  };
};
