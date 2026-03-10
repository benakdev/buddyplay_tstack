import { describe, expect, it } from 'vitest';

import {
  getAvailabilityOverlapPercent,
  getMatchPercentage,
  getRatingClosenessPercent,
  haveCompatiblePadelTiers,
  isReciprocalSkillMatch
} from './playerMatching';

function createAvailability(selections: Array<[day: string, slot: string]>): Record<string, Record<string, boolean>> {
  const availability: Record<string, Record<string, boolean>> = {};

  for (const [day, slot] of selections) {
    availability[day] ??= {};
    availability[day][slot] = true;
  }

  return availability;
}

describe('playerMatching', () => {
  it('keeps same-club perfect matches at or below 100%', () => {
    const percentage = getMatchPercentage({
      sameClub: true,
      ratingClosenessPercent: 100,
      availabilityOverlapPercent: 100
    });

    expect(percentage).toBe(100);
  });

  it('caps availability-heavy matches at 100%', () => {
    const percentage = getMatchPercentage({
      sameClub: true,
      ratingClosenessPercent: 135,
      availabilityOverlapPercent: 140
    });

    expect(percentage).toBe(100);
  });

  it('does not propagate NaN through match percentages', () => {
    const percentage = getMatchPercentage({
      sameClub: true,
      ratingClosenessPercent: Number.NaN,
      availabilityOverlapPercent: null
    });

    expect(percentage).toBe(0);
  });

  it('falls back to rating-only when availability is missing', () => {
    const ratingClosenessPercent = getRatingClosenessPercent(4.5, 4.2);
    const percentage = getMatchPercentage({
      sameClub: true,
      ratingClosenessPercent,
      availabilityOverlapPercent: null
    });

    expect(percentage).toBeCloseTo(ratingClosenessPercent, 5);
  });

  it('uses reciprocal tolerances instead of the current profile only', () => {
    expect(
      isReciprocalSkillMatch({
        currentSkillLevel: 4,
        currentTolerance: 0.2,
        candidateSkillLevel: 4.6,
        candidateTolerance: 0.05
      })
    ).toBe(false);

    expect(
      isReciprocalSkillMatch({
        currentSkillLevel: 4,
        currentTolerance: 0.2,
        candidateSkillLevel: 4.6,
        candidateTolerance: 0.2
      })
    ).toBe(true);
  });

  it('returns no visible match percentage for cross-club results', () => {
    const percentage = getMatchPercentage({
      sameClub: false,
      ratingClosenessPercent: 95,
      availabilityOverlapPercent: 100
    });

    expect(percentage).toBeNull();
  });

  it('derives availability overlap from the current profile selections', () => {
    const currentAvailability = createAvailability([
      ['monday', 'morning'],
      ['monday', 'evening'],
      ['wednesday', 'afternoon']
    ]);
    const candidateAvailability = createAvailability([
      ['monday', 'morning'],
      ['wednesday', 'afternoon'],
      ['friday', 'evening']
    ]);

    expect(getAvailabilityOverlapPercent(currentAvailability, candidateAvailability)).toBeCloseTo(66.6667, 3);
  });

  it('treats missing availability as omitted from scoring', () => {
    expect(getAvailabilityOverlapPercent(undefined, undefined)).toBeNull();
  });

  it('rejects padel pro-vs-amateur comparisons', () => {
    expect(
      haveCompatiblePadelTiers({
        currentWprRating: 17,
        currentGender: 'Male',
        candidateWprRating: 10,
        candidateGender: 'Male'
      })
    ).toBe(false);

    expect(
      haveCompatiblePadelTiers({
        currentWprRating: 15,
        currentGender: 'Male',
        candidateWprRating: 14,
        candidateGender: 'Male'
      })
    ).toBe(true);
  });
});
