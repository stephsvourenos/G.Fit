// The player calls this about every 12 seconds while a video is open.
// The SERVER sets the time each heartbeat arrived — the app's clock is never trusted.
// Accepts a heartbeat only for a session this server opened, for a profile the
// caller owns, within 12 hours of starting. Duplicate sequence numbers are ignored.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, asUser, cors, json } from "../_shared/http.ts";

const MIN_GAP_MS = 2_000;
const MAX_SESSION_MS = 12 * 3600_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const b = await req.json();
    if (typeof b.session_id !== "string" || !Number.isInteger(b.seq) || b.seq < 0 || b.seq > 100_000) return json({ error: "bad request" }, 400);

    const s = await asServer(`playback_sessions?id=eq.${encodeURIComponent(b.session_id)}&select=id,profile_id,started_at,last_heartbeat_at`);
    const session = s.data?.[0];
    if (!session) return json({ error: "unknown session" }, 404);
    // The caller must own the profile (checked with the caller's own permissions).
    const own = await asUser(auth, `profiles?id=eq.${session.profile_id}&select=id`);
    if (!own.data?.length) return json({ error: "not your session" }, 403);

    const now = Date.now();
    if (now - new Date(session.started_at).getTime() > MAX_SESSION_MS) return json({ error: "session expired" }, 410);
    if (session.last_heartbeat_at && now - new Date(session.last_heartbeat_at).getTime() < MIN_GAP_MS) {
      return json({ ok: true, ignored: "too-soon" }, 202);
    }

    const pos = Number(b.position_sec);
    const rate = Number(b.playback_rate ?? 1);
    const ins = await asServer("playback_heartbeats", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        session_id: session.id,
        seq: b.seq,
        position_sec: Number.isFinite(pos) && pos >= 0 ? pos : 0,
        playing: b.playing === true,
        visible: b.visible === true,
        buffering: b.buffering === true,
        playback_rate: Number.isFinite(rate) ? rate : 1,
        casting: b.casting === true,
      }),
    });
    if (ins.ok && Array.isArray(ins.data) && ins.data.length === 0) return json({ ok: true, ignored: "duplicate" }, 202);
    if (!ins.ok) return json({ error: "could not record" }, 500);

    await asServer(`playback_sessions?id=eq.${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_heartbeat_at: new Date(now).toISOString(), evaluated_at: null }),
    });
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
