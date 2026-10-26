/** Shared catalogue and household types used by web, mobile, admin and server. */

export const AGE_BANDS = ["under-6", "6-8", "9-12", "13-15", "16-17", "adult"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  "under-6": "Under 6",
  "6-8": "6–8",
  "9-12": "9–12",
  "13-15": "13–15",
  "16-17": "16–17",
  adult: "Adult",
};

export function isChildBand(band: AgeBand): boolean {
  return band !== "adult";
}

export const CATEGORIES = [
  "soccer",
  "pilates",
  "move-and-play",
  "dance",
  "strength",
  "mobility",
  "challenges",
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  soccer: "Soccer",
  pilates: "Pilates",
  "move-and-play": "Move & Play",
  dance: "Dance",
  strength: "Strength",
  mobility: "Mobility",
  challenges: "Challenges",
};

export type Intensity = "gentle" | "moderate" | "energetic";
export type Equipment = "none" | "wall" | "ball" | "mat" | "light-weights" | "chair";

/** Content workflow states, in order. */
export const CONTENT_STATES = [
  "draft",
  "uploaded",
  "awaiting-review",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

export interface Instructor {
  id: string;
  displayName: string;
  /** Instructor is a minor: extra safeguards apply (no external links, guardian-managed contract). */
  isMinor: boolean;
  bio: string;
  specialties: CategoryId[];
  creatorId: string;
  accent: string;
}

export interface Workout {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  /** Primary licensed creator (MVP: exactly one; splits supported later). */
  creatorId: string;
  category: CategoryId;
  durationSec: number;
  intensity: Intensity;
  equipment: Equipment[];
  /** Age bands the workout is approved for. */
  ageBands: AgeBand[];
  captions: boolean;
  accessibilityNotes?: string;
  state: ContentState;
  publishedAt?: string;
  rights: RightsChecklist;
  thumbnail: { from: string; to: string; emoji: string };
}

export interface RightsChecklist {
  creatorLicenceSigned: boolean;
  musicCleared: boolean;
  safetyReviewed: boolean;
  /** Required when any featured instructor is a minor. */
  guardianConsent: boolean | "not-applicable";
  territories: string[];
}

export interface PublishCheck {
  ok: boolean;
  problems: string[];
}

/** A workout can only be published when rights and safety approvals are complete. */
export function canPublish(w: Workout, instructor: Instructor | undefined): PublishCheck {
  const problems: string[] = [];
  if (!w.rights.creatorLicenceSigned) problems.push("Creator licence not signed");
  if (!w.rights.musicCleared) problems.push("Music rights not cleared");
  if (!w.rights.safetyReviewed) problems.push("Safety review not completed");
  if (instructor?.isMinor && w.rights.guardianConsent !== true) {
    problems.push("Guardian consent missing for a minor instructor");
  }
  if (w.rights.territories.length === 0) problems.push("No licensed territories");
  if (w.ageBands.length === 0) problems.push("No age eligibility set");
  if (w.state !== "approved" && w.state !== "scheduled") {
    problems.push(`Must be approved before publishing (currently ${w.state})`);
  }
  return { ok: problems.length === 0, problems };
}

export interface Profile {
  id: string;
  householdId: string;
  nickname: string;
  avatar: { emoji: string; colour: string };
  ageBand: AgeBand;
  interests: CategoryId[];
  /** Adult profiles and the account owner are protected by the parent PIN. */
  pinProtected: boolean;
  /** Extra restriction a parent can apply on top of age band. */
  maxIntensity?: Intensity;
}

export interface WorkoutFilter {
  ageBand?: AgeBand;
  category?: CategoryId;
  intensity?: Intensity;
  maxDurationSec?: number;
  equipment?: Equipment;
  instructorId?: string;
  captionsOnly?: boolean;
  query?: string;
}

const INTENSITY_ORDER: Intensity[] = ["gentle", "moderate", "energetic"];

export function isAllowedForProfile(w: Workout, p: Profile): boolean {
  if (w.state !== "published") return false;
  if (!w.ageBands.includes(p.ageBand)) return false;
  if (p.maxIntensity && INTENSITY_ORDER.indexOf(w.intensity) > INTENSITY_ORDER.indexOf(p.maxIntensity)) {
    return false;
  }
  return true;
}

export function filterWorkouts(list: Workout[], f: WorkoutFilter): Workout[] {
  const q = f.query?.trim().toLowerCase();
  return list.filter((w) => {
    if (f.ageBand && !w.ageBands.includes(f.ageBand)) return false;
    if (f.category && w.category !== f.category) return false;
    if (f.intensity && w.intensity !== f.intensity) return false;
    if (f.maxDurationSec && w.durationSec > f.maxDurationSec) return false;
    if (f.equipment && !w.equipment.includes(f.equipment)) return false;
    if (f.instructorId && w.instructorId !== f.instructorId) return false;
    if (f.captionsOnly && !w.captions) return false;
    if (q && !`${w.title} ${w.description} ${w.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  return m < 1 ? `${sec}s` : `${m} min`;
}
