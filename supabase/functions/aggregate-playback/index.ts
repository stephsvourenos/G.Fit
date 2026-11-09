// Scheduled job (every 15 minutes via pg_cron) — or "Run now" by an admin.
// Turns heartbeats into qualified minutes using the SAME rules as the app
// (playback.ts is a copy of packages/domain/src/playback.ts; a unit test keeps them identical).
// Recomputes whole household-months so monthly caps and concurrency rules
// see every session together. Safe to run repeatedly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, json, staffRoles, serverError } from "../_shared/http.ts";
import {
  aggregateQualifiedViews,
  DEFAULT_PLAYBACK_POLICY as P,
  evaluateSessions,
  type Heartbeat,
  type PlaybackSession,
} from "../_shared/playback.ts";

const SETTLE_MS = 10 * 60_000; // a session is evaluated once it has been quiet for 10 minutes

const monthOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: P.timeZone, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);

function monthBoundsUtc(month: string): [string, string] {
  // Generous window (±1 day) then filter precisely by Sydney month.
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 86_400_000).toISOString();
  const end = new Date(Date.UTC(y, m, 1) + 86_400_000).toISOString();
  return [start, end];
}

async function fetchAll(path: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await asServer(path, { headers: { Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!r.ok) throw new Error(`fetch ${path}: ${JSON.stringify(r.data)}`);
    out.push(...r.data);
    if (r.data.length < 1000) return out;
  }
}

async function authorised(req: Request): Promise<boolean> {
  const nonce = req.headers.get("x-cron-nonce");
  if (nonce) {
    const r = await asServer("rpc/consume_cron_nonce", { method: "POST", body: JSON.stringify({ n: nonce }) });
    return r.data === true;
  }
  const roles = await staffRoles(req.headers.get("Authorization") ?? "");
  return roles.includes("admin") || roles.includes("finance");
}

Deno.serve(async (req) => {
  try {
    if (!(await authorised(req))) return json({ error: "not allowed" }, 403);
    const body = await req.json().catch(() => ({}));
    const settleBefore = new Date(Date.now() - (body.now ? 0 : SETTLE_MS)).toISOString();

    const pending = await fetchAll(
      `playback_sessions?evaluated_at=is.null&last_heartbeat_at=lt.${settleBefore}&select=household_id,started_at`,
    );
    const work = new Map<string, { household: string; month: string }>();
    for (const s of pending) work.set(`${s.household_id}|${monthOf(s.started_at)}`, { household: s.household_id, month: monthOf(s.started_at) });

    let sessionsDone = 0, viewsWritten = 0;
    for (const { household, month } of work.values()) {
      const [from, to] = monthBoundsUtc(month);
      const rows = (await fetchAll(
        `playback_sessions?household_id=eq.${household}&started_at=gte.${from}&started_at=lt.${to}&select=*`,
      )).filter((r) => monthOf(r.started_at) === month);
      if (!rows.length) continue;
      const ids = rows.map((r) => r.id);
      const hbRows = await fetchAll(`playback_heartbeats?session_id=in.(${ids.join(",")})&select=*&order=seq`);

      const sessions: PlaybackSession[] = rows.map((r) => ({
        sessionId: r.id, householdId: r.household_id, profileId: r.profile_id, workoutId: r.workout_id,
        creatorId: r.creator_id, deviceId: r.device_id, durationSec: r.duration_sec, tokenIssued: true,
        accessibilityMode: r.accessibility_mode, startedAt: new Date(r.started_at).getTime(),
      }));
      const beats: Heartbeat[] = hbRows.map((h) => ({
        sessionId: h.session_id, seq: h.seq, receivedAt: new Date(h.received_at).getTime(),
        positionSec: Number(h.position_sec), playing: h.playing, visible: h.visible, buffering: h.buffering,
        playbackRate: Number(h.playback_rate), casting: h.casting === true,
      }));

      const evals = evaluateSessions(sessions, beats, P);
      const agg = aggregateQualifiedViews(sessions, evals, P);

      // Replace this household-month's results in one go.
      await asServer(`qualified_views?session_id=in.(${ids.join(",")})`, { method: "DELETE" });
      await asServer(`playback_anomalies?session_id=in.(${ids.join(",")})`, { method: "DELETE" });
      if (agg.views.length) {
        await asServer("qualified_views", {
          method: "POST",
          body: JSON.stringify(agg.views.map((v) => ({
            session_id: v.sessionId, household_id: v.householdId, profile_id: v.profileId, workout_id: v.workoutId,
            creator_id: v.creatorId, day: v.day, month: v.month, credited_sec: Math.round(v.creditedSec), policy_version: P.version,
          }))),
        });
      }
      const anomalies = [
        ...agg.anomalies.map((a) => ({ session_id: a.sessionId, household_id: household, reason: a.reason })),
        ...evals.filter((e) => e.flags.includes("seek-detected") || e.flags.includes("duplicate-profile-stream") || e.flags.includes("concurrency-limit"))
          .map((e) => ({ session_id: e.sessionId, household_id: household, reason: e.flags.join(", ") })),
      ];
      if (anomalies.length) await asServer("playback_anomalies", { method: "POST", body: JSON.stringify(anomalies) });

      const credited = new Map(agg.views.map((v) => [v.sessionId, Math.round(v.creditedSec)]));
      const stamp = new Date().toISOString();
      for (const e of evals) {
        await asServer(`playback_sessions?id=eq.${e.sessionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            evaluated_at: stamp, distinct_watched_sec: Math.round(e.distinctWatchedSec), coverage: Number(e.coverage.toFixed(4)),
            qualifies: e.qualifies, credited_sec: credited.get(e.sessionId) ?? 0, flags: e.flags,
          }),
        });
        sessionsDone++;
      }
      viewsWritten += agg.views.length;
    }
    return json({ ok: true, householdMonths: work.size, sessionsEvaluated: sessionsDone, qualifiedViews: viewsWritten, policy: P.version });
  } catch (e) {
    console.error(e);
    return serverError("aggregate-playback", e);
  }
});
