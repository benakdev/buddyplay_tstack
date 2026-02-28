import type { Availability, Sport, TimeSlot } from "./types";

/**
 * Get descriptive label for a skill level.
 * Labels are consistent across sports.
 */
// ============================================
// SKILLS & RATINGS
// ============================================

export function getPlaytomicLabel(level: number): string {
	if (level >= 7.0) return "World-class pro (top-tier)";
	if (level >= 6.5) return "Pro (international level)";
	if (level >= 6.0) return "Semi-pro";
	if (level >= 5.5) return "Elite national";
	if (level >= 5.0) return "Advanced";
	if (level >= 4.5) return "High intermediate";
	if (level >= 4.0) return "Intermediate+";
	if (level >= 3.5) return "Intermediate";
	if (level >= 3.0) return "Improver";
	if (level >= 2.5) return "Beginner+";
	if (level >= 2.0) return "Beginner";
	if (level >= 1.5) return "New";
	if (level >= 1.0) return "Very new";
	if (level >= 0.5) return "First-timer";
	return "Unrated (no match history)";
}

export function getWPRLabel(level: number): string {
	if (level >= 21.0) return "World-class pro (top-tier)";
	if (level >= 18.0) return "Pro (international level)";
	if (level >= 16.0) return "Semi-pro";
	if (level >= 15.0) return "Elite national";
	if (level >= 14.0) return "Advanced";
	if (level >= 13.0) return "High intermediate";
	if (level >= 11.0) return "Intermediate+";
	if (level >= 10.0) return "Intermediate";
	if (level >= 8.0) return "Improver";
	if (level >= 6.0) return "Beginner+";
	if (level >= 4.0) return "Beginner";
	if (level >= 2.5) return "New";
	if (level >= 1.0) return "Very new";
	if (level >= 0.5) return "First-timer";
	return "Unrated (no match history)";
}

/**
 * Get descriptive label for a skill level.
 * Wraps specific logic for Padel ratings if needed, otherwise uses standard breakdown.
 */
export function getSkillLabel(sport: Sport, level: number): string {
	if (sport === "Padel") {
		// Default fallback for Padel if generic skillLevel is used (though Padel uses Playtomic/WPR mostly)
		// We can map generic Padel skillLevel to Playtomic-like structure if needed,
		// but usually Padel uses the specific ratings.
		// For now, let's keep a consistent 1-7ish mapping if this is ever called for generic "Level".
		return getPlaytomicLabel(level);
	}

	// Pickleball
	if (level >= 5.5) return "Elite";
	if (level >= 5.0) return "Pro";
	if (level >= 4.0) return "Advanced";
	if (level >= 2.5) return "Intermediate";
	return "Beginner";
}

/**
 * Generate summary line for a sport passport card.
 * Court Side is shown first for Padel (core differentiator).
 */
export function generatePassportSummary(
	sport: Sport,
	skillLevel: number,
	hand?: "Left" | "Right",
	courtSide?: "Left" | "Right" | "Both",
): string {
	const parts: string[] = [];

	// Court side first for Padel (core differentiator)
	if (sport === "Padel" && courtSide) {
		parts.push(courtSide === "Both" ? "Plays both sides" : `${courtSide} side`);
	}

	// Skill level with label
	parts.push(`Level ${skillLevel}`);

	// Hand
	if (hand) {
		parts.push(`${hand}-handed`);
	}

	return parts.join(" • ");
}

/**
 * Generate a smart summary of availability.
 * e.g., "Weekdays • Evenings" or "Tue, Thu • Mornings"
 */
export function getAvailabilitySummary(availability: Availability): string {
	const DAYS = [
		{ key: "monday", label: "Mon" },
		{ key: "tuesday", label: "Tue" },
		{ key: "wednesday", label: "Wed" },
		{ key: "thursday", label: "Thu" },
		{ key: "friday", label: "Fri" },
		{ key: "saturday", label: "Sat" },
		{ key: "sunday", label: "Sun" },
	] as const;

	// 0. Filter active days
	const activeDays = DAYS.filter((d) => {
		const slots = availability[d.key];
		return slots && Object.values(slots).some(Boolean);
	});

	if (activeDays.length === 0) return "No availability set";

	// Helper to check if two slots are identical
	const areSlotsEqual = (a: TimeSlot | undefined, b: TimeSlot | undefined) => {
		if (!a || !b) return false;
		return (
			!!a.morning === !!b.morning &&
			!!a.afternoon === !!b.afternoon &&
			!!a.evening === !!b.evening
		);
	};

	// 1. Determine Day String
	const isAllDays = activeDays.length === 7;
	const isWeekdays =
		activeDays.length === 5 &&
		activeDays.every((d) =>
			["monday", "tuesday", "wednesday", "thursday", "friday"].includes(d.key),
		);
	const isWeekends =
		activeDays.length === 2 &&
		activeDays.every((d) => ["saturday", "sunday"].includes(d.key));

	let dayStr = "";
	if (isAllDays) dayStr = "Every day";
	else if (isWeekdays) dayStr = "Weekdays";
	else if (isWeekends) dayStr = "Weekends";
	else dayStr = activeDays.map((d) => d.label).join(", ");

	// 2. Determine Time String
	// Check if all active days have the same time slots
	const firstDaySlots = availability[activeDays[0].key];
	const isConsistent = activeDays.every((d) =>
		areSlotsEqual(availability[d.key], firstDaySlots),
	);

	if (isConsistent && firstDaySlots) {
		const timeParts = [];
		if (firstDaySlots.morning) timeParts.push("Mornings");
		if (firstDaySlots.afternoon) timeParts.push("Afternoons");
		if (firstDaySlots.evening) timeParts.push("Evenings");

		// If all times selected for these days, maybe say "All times" or just "Anytime"?
		// But "Mornings, Afternoons, Evenings" is fine or join logic checks breadth.
		// If specifically all 3 are true:
		if (
			firstDaySlots.morning &&
			firstDaySlots.afternoon &&
			firstDaySlots.evening
		) {
			return `${dayStr} • Anytime`;
		}

		return `${dayStr} • ${timeParts.join(", ")}`;
	} else {
		return `${dayStr} • Mixed times`;
	}
}
