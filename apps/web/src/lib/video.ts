"use client";

import { supabase } from "./supabase";

export type PlaybackDenial = "no-entitlement" | "pin-required" | "age-restricted" | "not-published" | "not-your-profile";

export type PlaybackGrant =
  | { allowed: false; reason: PlaybackDenial }
  | { allowed: true; video: false }
  | { allowed: true; video: true; playbackId: string; tokens: { playback: string; thumbnail: string; storyboard: string }; expiresInSec: number };

/** Ask the server for permission + short-lived signed links (see supabase/functions/playback-token). */
export async function requestPlayback(appWorkoutId: string, profileId: string): Promise<PlaybackGrant> {
  const slug = appWorkoutId.replace(/^wk-/, "");
  const { data, error } = await supabase().functions.invoke("playback-token", { body: { slug, profile_id: profileId } });
  if (data) return data as PlaybackGrant;
  // Denials come back with a 4xx status; supabase-js puts the body on the error's context.
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      return (await ctx.json()) as PlaybackGrant;
    } catch {
      /* fall through */
    }
  }
  throw error ?? new Error("Could not start the video");
}

export const DENIAL_MESSAGE: Record<PlaybackDenial, string> = {
  "no-entitlement": "Videos unlock once your family membership is active.",
  "pin-required": "This is an adult profile — a parent needs to enter the PIN again.",
  "age-restricted": "This workout isn’t available on this profile.",
  "not-published": "This workout isn’t available yet.",
  "not-your-profile": "Please choose one of your family’s profiles first.",
};

/* ---------- admin ---------- */

export async function videoAdmin(action: "create-upload" | "use-sample" | "refresh", workoutId: string) {
  const { data, error } = await supabase().functions.invoke("video-admin", {
    body: { action, workout_id: workoutId, origin: window.location.origin },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    try {
      msg = (await ctx?.json())?.error ?? msg;
    } catch {
      /* keep message */
    }
    throw new Error(msg);
  }
  return data as Record<string, unknown> & { uploadUrl?: string; video_status?: string };
}

/** Send a file straight from the browser to Mux, reporting progress (0–100). */
export function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.send(file);
  });
}
