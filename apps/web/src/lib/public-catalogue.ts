import { coachPortraitUrl, type AgeBand, type CategoryId, type Equipment, type Intensity } from "@app/domain";
import { instructors as mockInstructors, programs as mockProgrammes, workouts as mockWorkouts } from "@app/mock-data";

/**
 * The public website's view of the catalogue: published workouts and adult instructors only, metadata only.
 * Live mode reads the `public_workouts` / `public_instructors` views with the public (publishable) key.
 * Mock mode (no Supabase settings) uses the sample catalogue so the site can be previewed without accounts.
 */

export interface PublicWorkout {
  slug: string;
  title: string;
  description: string;
  category: CategoryId;
  durationSec: number;
  intensity: Intensity;
  equipment: Equipment[];
  ageBands: AgeBand[];
  captions: boolean;
  accessibilityNotes?: string;
  publishedAt?: string;
  thumbnail: { from: string; to: string; emoji: string };
  /** Missing for junior (under-18) coaches, who are never named on public pages. */
  instructorSlug?: string;
  instructorName?: string;
}

export interface PublicInstructor {
  slug: string;
  name: string;
  bio: string;
  specialties: CategoryId[];
  accent: string;
  portraitUrl?: string;
  workoutCount: number;
}

export interface PublicProgramme {
  slug: string;
  title: string;
  description: string;
  thumbnail: { from: string; to: string; emoji: string };
  publishedAt?: string;
  instructorSlug?: string;
  instructorName?: string;
  workoutCount: number;
  totalDurationSec: number;
  ageBands: AgeBand[];
  categories: CategoryId[];
  /** Workout slugs in order (published workouts only). */
  steps: string[];
}

export interface Catalogue {
  workouts: PublicWorkout[];
  instructors: PublicInstructor[];
  programmes: PublicProgramme[];
  /** False when the live catalogue couldn't be reached — pages show a gentle "come back soon" instead of an error. */
  ok: boolean;
  mock: boolean;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`catalogue ${res.status}`);
  return (await res.json()) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadLive(): Promise<Catalogue> {
  try {
    const [w, i, p, steps] = await Promise.all([
      rest<any[]>("public_workouts?select=*&order=published_at.desc.nullslast"),
      rest<any[]>("public_instructors?select=*&order=display_name"),
      // Programmes arrived later; if their views aren't there yet the rest of the site still works.
      rest<any[]>("public_programmes?select=*&order=published_at.desc.nullslast").catch(() => []),
      rest<any[]>("public_programme_workouts?select=*&order=programme_slug,step").catch(() => []),
    ]);
    return {
      ok: true,
      mock: false,
      workouts: w.map((r) => ({
        slug: r.slug,
        title: r.title,
        description: r.description ?? "",
        category: r.category,
        durationSec: r.duration_sec,
        intensity: r.intensity,
        equipment: r.equipment ?? [],
        ageBands: r.age_bands ?? [],
        captions: Boolean(r.captions),
        accessibilityNotes: r.accessibility_notes ?? undefined,
        publishedAt: r.published_at?.slice(0, 10),
        thumbnail: { from: r.thumbnail?.from ?? "#2e2a3b", to: r.thumbnail?.to ?? "#e0177a", emoji: r.thumbnail?.emoji ?? "🎬" },
        instructorSlug: r.instructor_slug ?? undefined,
        instructorName: r.instructor_name ?? undefined,
      })),
      instructors: i.map((r) => ({
        slug: r.slug,
        name: r.display_name,
        bio: r.bio ?? "",
        specialties: r.specialties ?? [],
        accent: r.accent ?? "#e0177a",
        portraitUrl: r.portrait_path ? coachPortraitUrl(url ?? "", r.portrait_path) : undefined,
        workoutCount: r.workout_count ?? 0,
      })),
      programmes: p.map((r) => ({
        slug: r.slug,
        title: r.title,
        description: r.description ?? "",
        thumbnail: { from: r.thumbnail?.from ?? "#2e2a3b", to: r.thumbnail?.to ?? "#e0177a", emoji: r.thumbnail?.emoji ?? "📅" },
        publishedAt: r.published_at?.slice(0, 10),
        instructorSlug: r.instructor_slug ?? undefined,
        instructorName: r.instructor_name ?? undefined,
        workoutCount: r.workout_count ?? 0,
        totalDurationSec: r.total_duration_sec ?? 0,
        ageBands: r.age_bands ?? [],
        categories: r.categories ?? [],
        steps: steps.filter((x) => x.programme_slug === r.slug).map((x) => x.workout_slug as string),
      })),
    };
  } catch {
    return { ok: false, mock: false, workouts: [], instructors: [], programmes: [] };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function loadMock(): Catalogue {
  const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const adults = new Map(mockInstructors.filter((i) => !i.isMinor).map((i) => [i.id, i]));
  const workouts: PublicWorkout[] = mockWorkouts
    .filter((w) => w.state === "published")
    .map((w) => {
      const ins = adults.get(w.instructorId);
      return {
        slug: w.id.replace(/^wk-/, ""),
        title: w.title,
        description: w.description,
        category: w.category,
        durationSec: w.durationSec,
        intensity: w.intensity,
        equipment: w.equipment,
        ageBands: w.ageBands,
        captions: w.captions,
        accessibilityNotes: w.accessibilityNotes,
        publishedAt: w.publishedAt,
        thumbnail: w.thumbnail,
        instructorSlug: ins ? slugOf(ins.displayName) : undefined,
        instructorName: ins?.displayName,
      };
    });
  const instructors: PublicInstructor[] = [...adults.values()]
    .map((i) => ({
      slug: slugOf(i.displayName),
      name: i.displayName,
      bio: i.bio,
      specialties: i.specialties,
      accent: i.accent,
      workoutCount: workouts.filter((w) => w.instructorName === i.displayName).length,
    }))
    .filter((i) => i.workoutCount > 0);
  const bySlug = new Map(workouts.map((w) => [w.slug, w]));
  const programmes: PublicProgramme[] = mockProgrammes.map((p) => {
    const ws = p.workoutIds.map((id) => bySlug.get(id.replace(/^wk-/, ""))).filter((w): w is PublicWorkout => Boolean(w));
    const lead = ws.find((w) => w.instructorName);
    return {
      slug: p.id.replace(/^pg-/, ""),
      title: p.title,
      description: p.blurb,
      thumbnail: { from: ws[0]?.thumbnail.from ?? "#2e2a3b", to: ws[0]?.thumbnail.to ?? "#e0177a", emoji: p.emoji },
      instructorSlug: lead?.instructorSlug,
      instructorName: lead?.instructorName,
      workoutCount: ws.length,
      totalDurationSec: ws.reduce((t, w) => t + w.durationSec, 0),
      ageBands: [...new Set(ws.flatMap((w) => w.ageBands))],
      categories: [...new Set(ws.map((w) => w.category))],
      steps: ws.map((w) => w.slug),
    };
  }).filter((p) => p.workoutCount > 0);
  return { ok: true, mock: true, workouts, instructors, programmes };
}

export async function getCatalogue(): Promise<Catalogue> {
  return url && key ? loadLive() : loadMock();
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: "No equipment",
  wall: "A wall",
  ball: "A ball",
  mat: "A mat",
  "light-weights": "Light weights",
  chair: "A chair",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  gentle: "Gentle",
  moderate: "Moderate",
  energetic: "Energetic",
};

export function needsNoEquipment(w: PublicWorkout): boolean {
  return w.equipment.length === 0 || w.equipment.every((e) => e === "none");
}

export function equipmentText(w: PublicWorkout): string {
  return needsNoEquipment(w) ? "No equipment" : w.equipment.filter((e) => e !== "none").map((e) => EQUIPMENT_LABEL[e]).join(", ");
}

/** Who a workout is for, in the website's words. */
export function audienceOf(w: PublicWorkout): "Kids" | "Teens" | "Adults" | "Everyone" {
  const kids = w.ageBands.some((b) => b === "under-6" || b === "6-8" || b === "9-12");
  const teens = w.ageBands.some((b) => b === "13-15" || b === "16-17");
  const adults = w.ageBands.includes("adult");
  if (adults && (kids || teens)) return "Everyone";
  if (adults) return "Adults";
  if (teens && !kids) return "Teens";
  return "Kids";
}
