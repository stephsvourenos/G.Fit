// Mux API + signed playback tokens (RS256 JWTs). Secrets come from Supabase
// Edge Function secrets and never leave the server.
import { asServer } from "./http.ts";

const TOKEN_ID = Deno.env.get("MUX_TOKEN_ID") ?? "";
const TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET") ?? "";
const SIGNING_KEY_ID = Deno.env.get("MUX_SIGNING_KEY_ID") ?? "";
const SIGNING_KEY = Deno.env.get("MUX_SIGNING_PRIVATE_KEY") ?? "";

/** Mux's own demo clip, used as a stand-in until real (licensed) workout videos exist. */
export const SAMPLE_VIDEO_URL = "https://storage.googleapis.com/muxdemofiles/mux.mp4";

export async function mux(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.mux.com${path}`, {
    ...init,
    headers: { Authorization: "Basic " + btoa(`${TOKEN_ID}:${TOKEN_SECRET}`), "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok && r.status !== 404) throw new Error(`Mux ${init.method ?? "GET"} ${path} failed (${r.status}): ${body?.error?.messages?.join(" ") ?? text.slice(0, 200)}`);
  return { status: r.status, data: body?.data };
}

/* ---------- workout ↔ Mux status sync (used by admin refresh and the webhook) ---------- */

interface WorkoutVideo { id: string; mux_upload_id: string | null; mux_asset_id: string | null }

export async function syncWorkoutVideo(w: WorkoutVideo): Promise<Record<string, unknown>> {
  let assetId = w.mux_asset_id;
  if (!assetId && w.mux_upload_id) {
    const up = await mux(`/video/v1/uploads/${w.mux_upload_id}`);
    assetId = up.data?.asset_id ?? null;
    if (up.data?.status === "errored" || up.data?.status === "timed_out" || up.data?.status === "cancelled") {
      return save(w.id, { video_status: "errored", video_error: `Upload ${up.data.status}` });
    }
    if (!assetId) return save(w.id, { video_status: "waiting" });
  }
  if (!assetId) return save(w.id, { video_status: "none" });
  const a = await mux(`/video/v1/assets/${assetId}`);
  if (a.status === 404) return save(w.id, { mux_asset_id: null, mux_playback_id: null, video_status: "none" });
  const signed = (a.data.playback_ids ?? []).find((p: { policy: string }) => p.policy === "signed");
  if (a.data.status === "ready" && signed) {
    return save(w.id, { mux_asset_id: assetId, mux_playback_id: signed.id, video_status: "ready", video_duration_sec: a.data.duration ?? null, video_error: null });
  }
  if (a.data.status === "errored") {
    return save(w.id, { mux_asset_id: assetId, video_status: "errored", video_error: (a.data.errors?.messages ?? []).join(" ") || "Processing failed" });
  }
  return save(w.id, { mux_asset_id: assetId, video_status: "processing" });
}

async function save(id: string, patch: Record<string, unknown>) {
  const r = await asServer(`workouts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`Could not save video status: ${JSON.stringify(r.data)}`);
  return { workout_id: id, ...patch };
}

/* ---------- signed playback tokens ---------- */

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) { out.unshift(n & 0xff); n >>= 8; }
  return [0x80 | out.length, ...out];
}

/** Mux gives an RSA key in PKCS#1; Web Crypto needs PKCS#8, so wrap it. */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const body = [0x02, 0x01, 0x00, ...algId, ...octet];
  return new Uint8Array([0x30, ...derLength(body.length), ...body]);
}

let keyPromise: Promise<CryptoKey> | undefined;
function signingKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    let pem = SIGNING_KEY.trim();
    if (!pem.includes("BEGIN")) pem = atob(pem);
    const pkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
    const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    let der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (pkcs1) der = pkcs1ToPkcs8(der);
    return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  })();
  return keyPromise;
}

/** aud: "v" video, "t" thumbnail, "s" storyboard. */
export async function signPlayback(playbackId: string, aud: "v" | "t" | "s", ttlSec: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT", kid: SIGNING_KEY_ID };
  const payload = { sub: playbackId, aud, exp: Math.floor(Date.now() / 1000) + ttlSec, kid: SIGNING_KEY_ID };
  const unsigned = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await signingKey(), new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}
