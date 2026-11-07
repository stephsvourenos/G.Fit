// Members ask here before playing a workout. The server checks — with the
// family's own permissions — that:
//   the profile belongs to this household, the household has an active
//   membership, the workout is published and suitable for the profile's age
//   band and intensity limit, and (adult profiles) the parent PIN was entered
//   in the last 10 minutes.
// Only then does it hand back short-lived signed links to the video.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, asUser, cors, json } from "../_shared/http.ts";
import { signPlayback } from "../_shared/mux.ts";

const INTENSITY = ["gentle", "moderate", "energetic"];

function hasAccess(e: { status: string; current_period_end: string; grace_days: number } | undefined): boolean {
  if (!e) return false;
  const now = Date.now();
  const end = new Date(e.current_period_end).getTime();
  const grace = end + e.grace_days * 86_400_000;
  if (e.status === "active" || e.status === "trialing" || e.status === "past_due") return now < grace;
  if (e.status === "canceled") return now < end;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { slug, profile_id, device_id } = await req.json();
    if (typeof slug !== "string" || typeof profile_id !== "string") return json({ error: "slug and profile_id required" }, 400);

    const prof = await asUser(auth, `profiles?id=eq.${encodeURIComponent(profile_id)}&select=id,household_id,age_band,max_intensity,pin_protected`);
    const profile = prof.data?.[0];
    if (!profile) return json({ allowed: false, reason: "not-your-profile" }, 403);

    const ent = await asUser(auth, `entitlements?household_id=eq.${profile.household_id}&select=provider,status,current_period_end,grace_days`);
    if (!hasAccess(ent.data?.[0])) return json({ allowed: false, reason: "no-entitlement" }, 402);

    if (profile.pin_protected) {
      const pin = await asServer(`household_pins?household_id=eq.${profile.household_id}&select=unlocked_until`);
      const until = pin.data?.[0]?.unlocked_until;
      if (!until || new Date(until).getTime() < Date.now()) return json({ allowed: false, reason: "pin-required" }, 401);
    }

    const wk = await asUser(auth, `workouts?slug=eq.${encodeURIComponent(slug)}&select=id,creator_id,duration_sec,state,age_bands,intensity,mux_playback_id,video_status,video_duration_sec`);
    const w = wk.data?.[0];
    if (!w || w.state !== "published") return json({ allowed: false, reason: "not-published" }, 404);
    if (!w.age_bands.includes(profile.age_band)) return json({ allowed: false, reason: "age-restricted" }, 403);
    if (profile.max_intensity && INTENSITY.indexOf(w.intensity) > INTENSITY.indexOf(profile.max_intensity)) {
      return json({ allowed: false, reason: "age-restricted" }, 403);
    }
    if (w.video_status !== "ready" || !w.mux_playback_id) return json({ allowed: true, video: false });

    // Long enough to finish the workout with pauses; short enough that a copied link soon stops working.
    const ttl = Math.min(6 * 3600, Math.ceil((w.video_duration_sec ?? 1800) * 3) + 900);
    const [playback, thumbnail, storyboard] = await Promise.all([
      signPlayback(w.mux_playback_id, "v", ttl),
      signPlayback(w.mux_playback_id, "t", ttl),
      signPlayback(w.mux_playback_id, "s", ttl),
    ]);
    // Open a playback session: heartbeats are only accepted for sessions the server started.
    const sess = await asServer("playback_sessions", {
      method: "POST",
      body: JSON.stringify({
        household_id: profile.household_id,
        profile_id: profile.id,
        workout_id: w.id,
        creator_id: w.creator_id,
        device_id: typeof device_id === "string" ? device_id.slice(0, 64) : "unknown",
        duration_sec: Math.max(1, Math.round(w.video_duration_sec ?? w.duration_sec)),
        // Paying, trialling or test grant at the time of viewing — only paid viewing earns royalties.
        membership_status: ent.data?.[0]?.status ?? null,
        membership_provider: ent.data?.[0]?.provider ?? null,
      }),
    });
    const sessionId = sess.data?.[0]?.id;
    return json({ allowed: true, video: true, playbackId: w.mux_playback_id, tokens: { playback, thumbnail, storyboard }, expiresInSec: ttl, sessionId });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
