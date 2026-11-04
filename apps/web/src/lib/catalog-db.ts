"use client";

import type { AgeBand, CategoryId, ContentState, Equipment, Instructor, Intensity, Workout } from "@app/domain";
import { supabase } from "./supabase";

/** Database rows → the shared app types (and back), for the admin content tools. */

export interface WorkoutRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructor_id: string;
  creator_id: string;
  category: string;
  duration_sec: number;
  intensity: Intensity;
  equipment: string[];
  age_bands: AgeBand[];
  captions: boolean;
  accessibility_notes: string | null;
  state: ContentState;
  published_at: string | null;
  rights_creator_licence_signed: boolean;
  rights_music_cleared: boolean;
  rights_safety_reviewed: boolean;
  rights_guardian_consent: boolean | null;
  territories: string[];
  thumbnail: { from?: string; to?: string; emoji?: string };
  video_status: VideoStatus;
  video_error: string | null;
  video_duration_sec: number | null;
}

export type VideoStatus = "none" | "waiting" | "processing" | "ready" | "errored";
export interface VideoInfo { status: VideoStatus; error: string | null; durationSec: number | null }
export const rowToVideo = (r: WorkoutRow): VideoInfo => ({ status: r.video_status, error: r.video_error, durationSec: r.video_duration_sec });

export const rowToWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  title: r.title,
  description: r.description,
  instructorId: r.instructor_id,
  creatorId: r.creator_id,
  category: r.category as CategoryId,
  durationSec: r.duration_sec,
  intensity: r.intensity,
  equipment: r.equipment as Equipment[],
  ageBands: r.age_bands,
  captions: r.captions,
  accessibilityNotes: r.accessibility_notes ?? undefined,
  state: r.state,
  publishedAt: r.published_at?.slice(0, 10),
  rights: {
    creatorLicenceSigned: r.rights_creator_licence_signed,
    musicCleared: r.rights_music_cleared,
    safetyReviewed: r.rights_safety_reviewed,
    guardianConsent: r.rights_guardian_consent === null ? "not-applicable" : r.rights_guardian_consent,
    territories: r.territories,
  },
  thumbnail: { from: r.thumbnail.from ?? "#334155", to: r.thumbnail.to ?? "#94A3B8", emoji: r.thumbnail.emoji ?? "🎬" },
});

/** Only the fields an admin can change from the content screen. */
export function workoutPatch(change: Partial<Workout>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (change.state) p.state = change.state;
  if (change.rights) {
    p.rights_creator_licence_signed = change.rights.creatorLicenceSigned;
    p.rights_music_cleared = change.rights.musicCleared;
    p.rights_safety_reviewed = change.rights.safetyReviewed;
    p.rights_guardian_consent = change.rights.guardianConsent === "not-applicable" ? null : change.rights.guardianConsent;
  }
  return p;
}

export async function loadCatalogForAdmin(): Promise<{ workouts: Workout[]; instructors: Instructor[]; videos: Record<string, VideoInfo> }> {
  const db = supabase();
  const [w, i] = await Promise.all([
    db.from("workouts").select("*").order("published_at", { ascending: true, nullsFirst: false }),
    db.from("instructors").select("*"),
  ]);
  if (w.error) throw w.error;
  if (i.error) throw i.error;
  return {
    workouts: (w.data as WorkoutRow[]).map(rowToWorkout),
    videos: Object.fromEntries((w.data as WorkoutRow[]).map((r) => [r.id, rowToVideo(r)])),
    instructors: (i.data ?? []).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      isMinor: r.is_minor,
      bio: r.bio,
      specialties: r.specialties as CategoryId[],
      creatorId: r.creator_id,
      accent: r.accent,
    })),
  };
}
