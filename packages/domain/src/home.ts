import { CATEGORIES, CATEGORY_LABEL, isAllowedForProfile, type Instructor, type Profile, type Workout } from "./catalog";

export interface HomeRow {
  id: string;
  title: string;
  workouts: Workout[];
  /** Progress seconds keyed by workout, for "Continue Watching". */
  progress?: Record<string, number>;
}

/**
 * Builds the personalised home screen for a profile. Every row only ever
 * contains workouts the profile is allowed to see (age band, intensity limit,
 * published). Shared by web and mobile.
 */
export function buildHomeRows(args: {
  profile: Profile;
  workouts: Workout[];
  instructors: Instructor[];
  progress: Record<string, number>;
  favourites: string[];
  completed: string[];
}): HomeRow[] {
  const { profile, instructors, progress, favourites, completed } = args;
  const allowed = args.workouts.filter((w) => isAllowedForProfile(w, profile));
  const rows: HomeRow[] = [];

  const inProgress = allowed.filter((w) => (progress[w.id] ?? 0) > 30 && (progress[w.id] ?? 0) < w.durationSec * 0.95);
  if (inProgress.length) rows.push({ id: "continue", title: "Continue Watching", workouts: inProgress, progress });

  const recommended = allowed
    .filter((w) => !completed.includes(w.id))
    .map((w) => ({ w, score: (profile.interests.includes(w.category) ? 3 : 0) + (w.captions ? 0.2 : 0) + (favourites.includes(w.id) ? -1 : 0) }))
    .sort((a, b) => b.score - a.score || a.w.title.localeCompare(b.w.title))
    .map((x) => x.w)
    .slice(0, 10);
  if (recommended.length) rows.push({ id: "recommended", title: "Recommended for You", workouts: recommended });

  if (profile.ageBand !== "adult") {
    rows.push({ id: "age", title: "Just Right for Your Age", workouts: allowed.slice(0, 12) });
  }

  const watchedInstructors = new Set(
    allowed.filter((w) => progress[w.id] || completed.includes(w.id) || favourites.includes(w.id)).map((w) => w.instructorId),
  );
  const yours = allowed.filter((w) => watchedInstructors.has(w.instructorId));
  if (yours.length) rows.push({ id: "instructors", title: "From Your Instructors", workouts: yours });

  const recent = [...allowed]
    .filter((w) => w.publishedAt)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 10);

  // Category rows, interests first.
  const ordered = [...CATEGORIES].sort(
    (a, b) => Number(profile.interests.includes(b)) - Number(profile.interests.includes(a)),
  );
  for (const c of ordered) {
    const list = allowed.filter((w) => w.category === c);
    if (list.length) rows.push({ id: `cat-${c}`, title: CATEGORY_LABEL[c], workouts: list });
  }

  if (recent.length) rows.push({ id: "recent", title: "Recently Added", workouts: recent });
  const saved = allowed.filter((w) => favourites.includes(w.id));
  if (saved.length) rows.push({ id: "saved", title: "Saved", workouts: saved });

  void instructors;
  return rows;
}

/** Simple, encouraging streak: consecutive days with at least one completed workout. */
export function currentStreak(completedDays: string[], today: string): number {
  const days = new Set(completedDays);
  let streak = 0;
  const d = new Date(`${today}T00:00:00Z`);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}
