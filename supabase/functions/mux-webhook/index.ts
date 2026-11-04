// Mux → us. Verifies Mux's signature, ignores repeat deliveries, then asks Mux
// for the current state of the video (never trusts the event body alone).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, json } from "../_shared/http.ts";
import { syncWorkoutVideo } from "../_shared/mux.ts";

const SECRET = Deno.env.get("MUX_WEBHOOK_SECRET") ?? "";
const TOLERANCE_SEC = 300;

async function validSignature(header: string | null, body: string): Promise<boolean> {
  if (!header || !SECRET) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SEC) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${body}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = parts.v1 ?? "";
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SECRET) return json({ error: "Webhook secret not configured" }, 503);
  const body = await req.text();
  if (!(await validSignature(req.headers.get("mux-signature"), body))) return json({ error: "Invalid signature" }, 401);

  const event = JSON.parse(body);
  const objectId: string | undefined = event.object?.id ?? event.data?.id;
  // Idempotency: the first delivery inserts, repeats conflict and are ignored.
  const ins = await asServer("mux_events", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({ event_id: event.id, type: event.type, object_id: objectId ?? null }),
  });
  if (ins.ok && Array.isArray(ins.data) && ins.data.length === 0) return json({ ok: true, duplicate: true });

  if (!String(event.type).startsWith("video.asset.") && !String(event.type).startsWith("video.upload.")) {
    return json({ ok: true, ignored: event.type });
  }
  const d = event.data ?? {};
  // Find the workout: by passthrough (asset events) or by upload ID (upload events).
  let q = "";
  if (d.passthrough && /^[0-9a-f-]{36}$/.test(d.passthrough)) q = `id=eq.${d.passthrough}`;
  else if (String(event.type).startsWith("video.upload.") && d.id) q = `mux_upload_id=eq.${encodeURIComponent(d.id)}`;
  else if (d.upload_id) q = `mux_upload_id=eq.${encodeURIComponent(d.upload_id)}`;
  else if (d.id) q = `mux_asset_id=eq.${encodeURIComponent(d.id)}`;
  if (!q) return json({ ok: true, unmatched: true });

  const w = await asServer(`workouts?${q}&select=id,mux_upload_id,mux_asset_id`);
  const workout = w.data?.[0];
  if (!workout) return json({ ok: true, unmatched: true });
  if (event.type === "video.upload.asset_created" && d.asset_id) workout.mux_asset_id = d.asset_id;
  if (event.type === "video.asset.deleted" && workout.mux_asset_id === d.id) {
    await asServer(`workouts?id=eq.${workout.id}`, { method: "PATCH", body: JSON.stringify({ mux_asset_id: null, mux_playback_id: null, video_status: "none" }) });
    return json({ ok: true });
  }
  return json({ ok: true, synced: await syncWorkoutVideo(workout) });
});
