import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type PlaybackDenial = "no-entitlement" | "pin-required" | "age-restricted" | "not-published" | "not-your-profile";

export type PlaybackGrant =
  | { allowed: false; reason: PlaybackDenial }
  | { allowed: true; video: false }
  | {
      allowed: true;
      video: true;
      playbackId: string;
      tokens: { playback: string; thumbnail: string; storyboard: string };
      expiresInSec: number;
      sessionId?: string;
    };

export const DENIAL_MESSAGE: Record<PlaybackDenial, string> = {
  "no-entitlement": "Videos unlock once your family membership is active.",
  "pin-required": "This is an adult profile — a parent needs to enter the PIN again.",
  "age-restricted": "This workout isn’t available on this profile.",
  "not-published": "This workout isn’t available yet.",
  "not-your-profile": "Please choose one of your family’s profiles first.",
};

/** A random ID for this phone (not linked to the person) — lets the server spot one device streaming twice. */
let cachedDevice: string | undefined;
async function deviceId(): Promise<string> {
  if (cachedDevice) return cachedDevice;
  const key = "gfit.device";
  try {
    let id = await AsyncStorage.getItem(key);
    if (!id) {
      id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(key, id);
    }
    cachedDevice = id;
    return id;
  } catch {
    return "no-storage";
  }
}

/** Ask the server for permission + short-lived signed links (same checks as the website). */
export async function requestPlayback(appWorkoutId: string, profileId: string): Promise<PlaybackGrant> {
  const slug = appWorkoutId.replace(/^wk-/, "");
  const { data, error } = await supabase().functions.invoke("playback-token", {
    body: { slug, profile_id: profileId, device_id: await deviceId() },
  });
  if (data) return data as PlaybackGrant;
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

/** Signed HLS address for the native player. */
export const streamUrl = (playbackId: string, token: string) => `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;

export interface HeartbeatPayload {
  seq: number;
  position_sec: number;
  playing: boolean;
  visible: boolean;
  buffering: boolean;
  playback_rate: number;
  casting: boolean;
}

let queue: Promise<unknown> = Promise.resolve();

/** Sent strictly one after another so the server sees them in order. Failures never interrupt the workout. */
export function sendHeartbeat(sessionId: string, beat: HeartbeatPayload): void {
  queue = queue
    .then(() => supabase().functions.invoke("heartbeat", { body: { session_id: sessionId, ...beat } }))
    .catch(() => undefined);
}

/** Every 12 seconds; a little more often on very short clips so they can be measured fairly. */
export const heartbeatMs = (durationSec: number) => Math.round(Math.max(5, Math.min(12, durationSec / 4)) * 1000);
