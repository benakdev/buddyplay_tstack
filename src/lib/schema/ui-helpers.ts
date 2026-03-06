import type { Availability, Sport, TimeSlot } from './types';

// ============================================
// SKILLS & RATINGS
// ============================================

/**
 * Configuration for skill level thresholds and their corresponding labels.
 */
interface LevelThreshold {
  threshold: number;
  label: string;
}

/**
 * Shared labels used across different rating systems.
 * Using a const object ensures no typos and enables IDE autocompletion.
 */
const SKILL_LABELS = {
  UNRATED: 'Unrated (no match history)',
  FIRST_TIMER: 'First-timer',
  VERY_NEW: 'Very new',
  NEW: 'New',
  BEGINNER: 'Beginner',
  BEGINNER_PLUS: 'Beginner+',
  IMPROVER: 'Improver',
  INTERMEDIATE: 'Intermediate',
  INTERMEDIATE_PLUS: 'Intermediate+',
  HIGH_INTERMEDIATE: 'High intermediate',
  ADVANCED: 'Advanced',
  ELITE_NATIONAL: 'Elite national',
  SEMI_PRO: 'Semi-pro',
  PRO: 'Pro (international level)',
  WORLD_CLASS_PRO: 'World-class pro (top-tier)',
  // Pickleball-specific labels
  PICKLEBALL_ELITE: 'Elite',
  PICKLEBALL_PRO: 'Pro'
} as const;

/**
 * Pickleball rating thresholds (0-5.5+ scale).
 * Thresholds must be in descending order for correct matching.
 */
const PICKLEBALL_THRESHOLDS: LevelThreshold[] = [
  { threshold: 5.5, label: SKILL_LABELS.PICKLEBALL_ELITE },
  { threshold: 5.0, label: SKILL_LABELS.PICKLEBALL_PRO },
  { threshold: 4.0, label: SKILL_LABELS.ADVANCED },
  { threshold: 2.5, label: SKILL_LABELS.INTERMEDIATE }
];

/**
 * Playtomic rating thresholds (0-7+ scale).
 * Thresholds must be in descending order for correct matching.
 */
const PLAYTOMIC_THRESHOLDS: LevelThreshold[] = [
  { threshold: 7.0, label: SKILL_LABELS.WORLD_CLASS_PRO },
  { threshold: 6.5, label: SKILL_LABELS.PRO },
  { threshold: 6.0, label: SKILL_LABELS.SEMI_PRO },
  { threshold: 5.5, label: SKILL_LABELS.ELITE_NATIONAL },
  { threshold: 5.0, label: SKILL_LABELS.ADVANCED },
  { threshold: 4.5, label: SKILL_LABELS.HIGH_INTERMEDIATE },
  { threshold: 4.0, label: SKILL_LABELS.INTERMEDIATE_PLUS },
  { threshold: 3.5, label: SKILL_LABELS.INTERMEDIATE },
  { threshold: 3.0, label: SKILL_LABELS.IMPROVER },
  { threshold: 2.5, label: SKILL_LABELS.BEGINNER_PLUS },
  { threshold: 2.0, label: SKILL_LABELS.BEGINNER },
  { threshold: 1.5, label: SKILL_LABELS.NEW },
  { threshold: 1.0, label: SKILL_LABELS.VERY_NEW },
  { threshold: 0.5, label: SKILL_LABELS.FIRST_TIMER }
];

/**
 * WPR (World Padel Rating) thresholds (0-21+ scale).
 * Thresholds must be in descending order for correct matching.
 */
const WPR_THRESHOLDS: LevelThreshold[] = [
  { threshold: 21.0, label: SKILL_LABELS.WORLD_CLASS_PRO },
  { threshold: 18.0, label: SKILL_LABELS.PRO },
  { threshold: 16.0, label: SKILL_LABELS.SEMI_PRO },
  { threshold: 15.0, label: SKILL_LABELS.ELITE_NATIONAL },
  { threshold: 14.0, label: SKILL_LABELS.ADVANCED },
  { threshold: 13.0, label: SKILL_LABELS.HIGH_INTERMEDIATE },
  { threshold: 11.0, label: SKILL_LABELS.INTERMEDIATE_PLUS },
  { threshold: 10.0, label: SKILL_LABELS.INTERMEDIATE },
  { threshold: 8.0, label: SKILL_LABELS.IMPROVER },
  { threshold: 6.0, label: SKILL_LABELS.BEGINNER_PLUS },
  { threshold: 4.0, label: SKILL_LABELS.BEGINNER },
  { threshold: 2.5, label: SKILL_LABELS.NEW },
  { threshold: 1.0, label: SKILL_LABELS.VERY_NEW },
  { threshold: 0.5, label: SKILL_LABELS.FIRST_TIMER }
];

/**
 * Validates that the level input is a finite, non-negative number.
 * Handles NaN, Infinity, and negative values.
 * @param level - The numeric level to validate
 * @returns true if valid, false otherwise
 */
function isValidLevel(level: number): boolean {
  return Number.isFinite(level) && level >= 0;
}

/**
 * Get descriptive label for a skill level based on threshold configuration.
 * Uses early-return pattern with descending thresholds for O(n) lookup.
 * @param thresholds - Array of LevelThreshold configurations (must be descending)
 * @param level - The numeric skill level
 * @returns Human-readable skill label
 */
function getLabelFromThresholds(thresholds: LevelThreshold[], level: number): string {
  if (!isValidLevel(level)) {
    return SKILL_LABELS.UNRATED;
  }

  for (const { threshold, label } of thresholds) {
    if (level >= threshold) {
      return label;
    }
  }

  return SKILL_LABELS.UNRATED;
}

/**
 * Get descriptive label for a Playtomic skill level.
 * @param level - Playtomic rating (0-7+)
 * @returns Human-readable skill label
 * @example
 * getPlaytomicLabel(6.5) // "Pro (international level)"
 * getPlaytomicLabel(NaN) // "Unrated (no match history)"
 */
export function getPlaytomicLabel(level: number): string {
  return getLabelFromThresholds(PLAYTOMIC_THRESHOLDS, level);
}

/**
 * Get descriptive label for a WPR (World Padel Rating) skill level.
 * @param level - WPR rating (0-21+)
 * @returns Human-readable skill label
 * @example
 * getWPRLabel(18.0) // "Pro (international level)"
 * getWPRLabel(-5) // "Unrated (no match history)"
 */
export function getWPRLabel(level: number): string {
  return getLabelFromThresholds(WPR_THRESHOLDS, level);
}

/**
 * Get descriptive label for a generic skill level by sport.
 * @param sport - The sport type
 * @param level - The numeric skill level
 * @returns Human-readable skill label
 */
export function getSkillLabel(sport: Sport, level: number): string {
  if (sport === 'Padel') {
    // Default fallback for Padel if generic skillLevel is used
    // (though Padel uses Playtomic/WPR mostly)
    return getPlaytomicLabel(level);
  }

  // Pickleball-specific thresholds
  return getLabelFromThresholds(PICKLEBALL_THRESHOLDS, level);
}

/**
 * Generate summary line for a sport passport card.
 * Court Side is shown first for Padel (core differentiator).
 */
export function generatePassportSummary(
  sport: Sport,
  skillLevel: number,
  hand?: 'Left' | 'Right',
  courtSide?: 'Left' | 'Right' | 'Both'
): string {
  const parts: string[] = [];

  // Court side first for Padel (core differentiator)
  if (sport === 'Padel' && courtSide) {
    parts.push(courtSide === 'Both' ? 'Plays both sides' : `${courtSide} side`);
  }

  // Skill level with label
  parts.push(`Level ${skillLevel}`);

  // Hand
  if (hand) {
    parts.push(`${hand}-handed`);
  }

  return parts.join(' • ');
}

/**
 * Generate a smart summary of availability.
 * e.g., "Weekdays • Evenings" or "Tue, Thu • Mornings"
 */
export function getAvailabilitySummary(availability: Availability): string {
  const DAYS = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
  ] as const;

  // 0. Filter active days
  const activeDays = DAYS.filter(d => {
    const slots = availability[d.key];
    return slots && Object.values(slots).some(Boolean);
  });

  if (activeDays.length === 0) return 'No availability set';

  // Helper to check if two slots are identical
  const areSlotsEqual = (a: TimeSlot | undefined, b: TimeSlot | undefined) => {
    if (!a || !b) return false;
    return !!a.morning === !!b.morning && !!a.afternoon === !!b.afternoon && !!a.evening === !!b.evening;
  };

  // 1. Determine Day String
  const isAllDays = activeDays.length === 7;
  const isWeekdays =
    activeDays.length === 5 &&
    activeDays.every(d => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d.key));
  const isWeekends = activeDays.length === 2 && activeDays.every(d => ['saturday', 'sunday'].includes(d.key));

  let dayStr = '';
  if (isAllDays) dayStr = 'Every day';
  else if (isWeekdays) dayStr = 'Weekdays';
  else if (isWeekends) dayStr = 'Weekends';
  else dayStr = activeDays.map(d => d.label).join(', ');

  // 2. Determine Time String
  // Check if all active days have the same time slots
  const firstDaySlots = availability[activeDays[0].key];
  const isConsistent = activeDays.every(d => areSlotsEqual(availability[d.key], firstDaySlots));

  if (isConsistent && firstDaySlots) {
    const timeParts = [];
    if (firstDaySlots.morning) timeParts.push('Mornings');
    if (firstDaySlots.afternoon) timeParts.push('Afternoons');
    if (firstDaySlots.evening) timeParts.push('Evenings');

    // If all times selected for these days, maybe say "All times" or just "Anytime"?
    // But "Mornings, Afternoons, Evenings" is fine or join logic checks breadth.
    // If specifically all 3 are true:
    if (firstDaySlots.morning && firstDaySlots.afternoon && firstDaySlots.evening) {
      return `${dayStr} • Anytime`;
    }

    return `${dayStr} • ${timeParts.join(', ')}`;
  } else {
    return `${dayStr} • Mixed times`;
  }
}
