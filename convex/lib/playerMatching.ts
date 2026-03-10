import type { Doc, Id } from '../_generated/dataModel';

const DEFAULT_MATCHING_TOLERANCE = 0.2;
const MATCH_RATING_WEIGHT = 70;
const MATCH_AVAILABILITY_WEIGHT = 30;
const MEN_WPR_CAP = 16;
const WOMEN_WPR_CAP = 12;

type Availability = Doc<'userSportProfiles'>['availability'];
type ClubId = Id<'clubs'> | undefined;
type PreferredGender = Doc<'userSportProfiles'>['preferredGender'];
type UserGender = Doc<'users'>['gender'];

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function countSelectedAvailabilitySlots(availability: Availability): number {
  if (!availability) return 0;

  let selected = 0;

  for (const slots of Object.values(availability)) {
    if (!slots) continue;

    for (const isSelected of Object.values(slots)) {
      if (isSelected) {
        selected += 1;
      }
    }
  }

  return selected;
}

export function genderMatchesPreference(preferredGender: PreferredGender, gender: UserGender): boolean {
  if (!preferredGender || preferredGender === 'Any') return true;
  return gender === preferredGender;
}

export function haveCompatibleGenderPreferences(args: {
  currentPreferredGender: PreferredGender;
  currentGender: UserGender;
  candidatePreferredGender: PreferredGender;
  candidateGender: UserGender;
}): boolean {
  return (
    genderMatchesPreference(args.currentPreferredGender, args.candidateGender) &&
    genderMatchesPreference(args.candidatePreferredGender, args.currentGender)
  );
}

export function getPadelTier(wprRating: number | undefined, gender: UserGender): 'amateur' | 'pro' {
  const cap = gender === 'Female' ? WOMEN_WPR_CAP : MEN_WPR_CAP;
  if (wprRating === undefined) return 'amateur';
  return wprRating > cap ? 'pro' : 'amateur';
}

export function haveCompatiblePadelTiers(args: {
  currentWprRating: number | undefined;
  currentGender: UserGender;
  candidateWprRating: number | undefined;
  candidateGender: UserGender;
}): boolean {
  const currentTier = getPadelTier(args.currentWprRating, args.currentGender);
  const candidateTier = getPadelTier(args.candidateWprRating, args.candidateGender);

  if (currentTier === 'pro' || candidateTier === 'pro') {
    return currentTier === candidateTier;
  }

  return true;
}

export function isSameClub(currentClubId: ClubId, candidateClubId: ClubId): boolean {
  return currentClubId !== undefined && candidateClubId !== undefined && currentClubId === candidateClubId;
}

export function isReciprocalSkillMatch(args: {
  currentSkillLevel: number | undefined;
  currentTolerance: number | undefined;
  candidateSkillLevel: number | undefined;
  candidateTolerance: number | undefined;
}): boolean {
  const { currentSkillLevel, candidateSkillLevel } = args;

  if (
    currentSkillLevel === undefined ||
    candidateSkillLevel === undefined ||
    !Number.isFinite(currentSkillLevel) ||
    !Number.isFinite(candidateSkillLevel) ||
    currentSkillLevel <= 0 ||
    candidateSkillLevel <= 0
  ) {
    return false;
  }

  const currentTolerance = currentSkillLevel * (args.currentTolerance ?? DEFAULT_MATCHING_TOLERANCE);
  const candidateTolerance = candidateSkillLevel * (args.candidateTolerance ?? DEFAULT_MATCHING_TOLERANCE);

  const matchesCurrent =
    candidateSkillLevel >= currentSkillLevel - currentTolerance &&
    candidateSkillLevel <= currentSkillLevel + currentTolerance;
  const matchesCandidate =
    currentSkillLevel >= candidateSkillLevel - candidateTolerance &&
    currentSkillLevel <= candidateSkillLevel + candidateTolerance;

  return matchesCurrent && matchesCandidate;
}

export function getRatingClosenessPercent(
  currentSkillLevel: number | undefined,
  candidateSkillLevel: number | undefined
): number {
  if (
    currentSkillLevel === undefined ||
    candidateSkillLevel === undefined ||
    !Number.isFinite(currentSkillLevel) ||
    !Number.isFinite(candidateSkillLevel) ||
    currentSkillLevel <= 0
  ) {
    return 0;
  }

  return clampPercentage(100 - Math.abs(currentSkillLevel - candidateSkillLevel) * (100 / currentSkillLevel));
}

export function getAvailabilityOverlapCount(availabilityA: Availability, availabilityB: Availability): number {
  if (!availabilityA || !availabilityB) return 0;

  let overlap = 0;

  for (const day of Object.keys(availabilityA) as Array<keyof NonNullable<Availability>>) {
    const slotsA = availabilityA[day];
    const slotsB = availabilityB[day];
    if (!slotsA || !slotsB) continue;

    for (const slotKey of Object.keys(slotsA) as Array<keyof typeof slotsA>) {
      if (slotsA[slotKey] && slotsB[slotKey]) {
        overlap += 1;
      }
    }
  }

  return overlap;
}

export function getAvailabilityOverlapPercent(
  currentAvailability: Availability,
  candidateAvailability: Availability
): number | null {
  const currentSelectedSlots = countSelectedAvailabilitySlots(currentAvailability);
  const candidateSelectedSlots = countSelectedAvailabilitySlots(candidateAvailability);

  if (currentSelectedSlots === 0 || candidateSelectedSlots === 0) {
    return null;
  }

  const overlapSlots = getAvailabilityOverlapCount(currentAvailability, candidateAvailability);

  return clampPercentage((overlapSlots / currentSelectedSlots) * 100);
}

export function getMatchPercentage(args: {
  sameClub: boolean;
  ratingClosenessPercent: number;
  availabilityOverlapPercent: number | null;
}): number | null {
  if (!args.sameClub) {
    return null;
  }

  const weightedComponents = [
    {
      value: clampPercentage(args.ratingClosenessPercent),
      weight: MATCH_RATING_WEIGHT
    }
  ];

  if (args.availabilityOverlapPercent !== null) {
    weightedComponents.push({
      value: clampPercentage(args.availabilityOverlapPercent),
      weight: MATCH_AVAILABILITY_WEIGHT
    });
  }

  const totalWeight = weightedComponents.reduce((sum, component) => sum + component.weight, 0);
  const weightedSum = weightedComponents.reduce((sum, component) => sum + component.value * component.weight, 0);

  return clampPercentage(weightedSum / totalWeight);
}
