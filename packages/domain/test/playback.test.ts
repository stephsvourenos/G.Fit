import { describe, expect, it } from "vitest";
import {
  aggregateQualifiedViews,
  DEFAULT_PLAYBACK_POLICY as P,
  evaluateSession,
  evaluateSessions,
  type Heartbeat,
  type PlaybackSession,
} from "../src";

const T0 = Date.UTC(2026, 10, 3, 0, 0, 0); // 3 Nov 2026 11:00 Sydney

function session(over: Partial<PlaybackSession> = {}): PlaybackSession {
  return {
    sessionId: "s1",
    householdId: "h1",
    profileId: "p1",
    workoutId: "w1",
    creatorId: "c1",
    deviceId: "d1",
    durationSec: 600,
    tokenIssued: true,
    accessibilityMode: false,
    startedAt: T0,
    ...over,
  };
}

/** Build heartbeats every `every` seconds of real time. `pos(t)` gives the player position at second t. */
function beats(
  sessionId: string,
  seconds: number,
  pos: (t: number) => number,
  opts: { every?: number; start?: number; state?: (t: number) => Partial<Heartbeat> } = {},
): Heartbeat[] {
  const every = opts.every ?? 12;
  const start = opts.start ?? T0;
  const out: Heartbeat[] = [];
  let seq = 0;
  for (let t = 0; t <= seconds; t += every) {
    out.push({
      sessionId,
      seq: seq++,
      receivedAt: start + t * 1000,
      positionSec: pos(t),
      playing: true,
      visible: true,
      buffering: false,
      playbackRate: 1,
      ...(opts.state?.(t) ?? {}),
    });
  }
  return out;
}

describe("qualified playback", () => {
  it("credits a legitimate full play by distinct watched seconds", () => {
    const e = evaluateSession(session(), beats("s1", 600, (t) => t));
    expect(e.qualifies).toBe(true);
    expect(e.creditedSec).toBe(600);
    expect(e.flags).toEqual([]);
  });

  it("skipping to the end earns nothing", () => {
    const e = evaluateSession(session(), beats("s1", 60, (t) => (t < 24 ? t : 580 + (t - 24))));
    expect(e.flags).toContain("seek-detected");
    expect(e.qualifies).toBe(false);
    expect(e.creditedSec).toBe(0);
  });

  it("skipping half the video falls below the 70% threshold", () => {
    // watches 0-300 then jumps to 450 and watches to 600 => 450/600 = 75%... jump to 480 => 70% boundary; use 500 => 66%
    const hb = beats("s1", 420, (t) => (t <= 300 ? t : 500 + (t - 312)));
    const e = evaluateSession(session(), hb);
    expect(e.coverage).toBeLessThan(0.7);
    expect(e.creditedSec).toBe(0);
  });

  it("time spent paused is not credited", () => {
    // plays 450s, then sits paused for 10 minutes, then plays the rest
    const hb = beats("s1", 1350, (t) => (t <= 450 ? t : t <= 1050 ? 450 : 450 + (t - 1050)), {
      state: (t) => ({ playing: t <= 450 || t > 1050 }),
    });
    const e = evaluateSession(session(), hb);
    expect(e.flags).toContain("background-or-paused");
    expect(e.creditedSec).toBeLessThanOrEqual(600);
    expect(e.qualifies).toBe(true);
  });

  it("background playback is not credited", () => {
    const e = evaluateSession(session(), beats("s1", 600, (t) => t, { state: () => ({ visible: false }) }));
    expect(e.creditedSec).toBe(0);
    expect(e.flags).toContain("background-or-paused");
  });

  it("buffering stalls do not count", () => {
    const e = evaluateSession(
      session(),
      beats("s1", 600, (t) => t, { state: (t) => ({ buffering: t > 120 && t < 360 }) }),
    );
    expect(e.flags).toContain("buffering");
    expect(e.qualifies).toBe(false);
  });

  it("an offline gap is not credited but play before and after is", () => {
    const hb = beats("s1", 600, (t) => t).filter((h) => h.receivedAt - T0 < 120_000 || h.receivedAt - T0 > 200_000);
    const e = evaluateSession(session(), hb);
    expect(e.flags).toContain("gap-too-long");
    expect(e.distinctWatchedSec).toBeLessThan(600);
    expect(e.distinctWatchedSec).toBeGreaterThan(450);
  });

  it("replayed (duplicate) heartbeats cannot inflate credit", () => {
    const hb = beats("s1", 600, (t) => t);
    const e = evaluateSession(session(), [...hb, ...hb, ...hb]);
    expect(e.creditedSec).toBe(600);
    expect(e.flags).toContain("duplicate-heartbeat");
  });

  it("rewatching a section inside one session counts it once", () => {
    // plays 0-300, rewinds to 0, plays 0-600
    const hb = beats("s1", 900, (t) => (t <= 300 ? t : t - 300));
    const e = evaluateSession(session(), hb);
    expect(e.creditedSec).toBe(600);
  });

  it("short videos need a higher share watched", () => {
    const s = session({ durationSec: 120 });
    const e = evaluateSession(s, beats("s1", 96, (t) => t)); // 80%
    expect(e.requiredFraction).toBe(0.85);
    expect(e.qualifies).toBe(false);
  });

  it("accessibility mode uses the lower threshold", () => {
    const e = evaluateSession(session({ accessibilityMode: true }), beats("s1", 336, (t) => t)); // 56%
    expect(e.qualifies).toBe(true);
    expect(e.creditedSec).toBe(336);
  });

  it("no signed playback token means no credit", () => {
    const e = evaluateSession(session({ tokenIssued: false }), beats("s1", 600, (t) => t));
    expect(e.creditedSec).toBe(0);
    expect(e.flags).toContain("no-playback-token");
  });

  it("the same profile on two devices at once only earns once", () => {
    const s1 = session({ sessionId: "a", deviceId: "phone" });
    const s2 = session({ sessionId: "b", deviceId: "tablet", startedAt: T0 + 1000, workoutId: "w2" });
    const ev = evaluateSessions([s1, s2], [...beats("a", 600, (t) => t), ...beats("b", 600, (t) => t, { start: T0 + 1000 })]);
    expect(ev.find((e) => e.sessionId === "a")!.creditedSec).toBe(600);
    expect(ev.find((e) => e.sessionId === "b")!.creditedSec).toBe(0);
  });

  it("household concurrency is capped", () => {
    const sessions = Array.from({ length: 6 }, (_, i) =>
      session({ sessionId: `s${i}`, profileId: `p${i}`, deviceId: `d${i}`, startedAt: T0 + i }),
    );
    const hb = sessions.flatMap((s) => beats(s.sessionId, 600, (t) => t, { start: s.startedAt }));
    const ev = evaluateSessions(sessions, hb);
    expect(ev.filter((e) => e.creditedSec > 0)).toHaveLength(P.maxConcurrentStreamsPerHousehold);
  });

  it("rapid repeats on the same day earn one credit; a repeat on another day earns again", () => {
    const day2 = T0 + 86_400_000;
    const sessions = [
      session({ sessionId: "a" }),
      session({ sessionId: "b", startedAt: T0 + 700_000 }),
      session({ sessionId: "c", startedAt: day2 }),
    ];
    const hb = [
      ...beats("a", 600, (t) => t),
      ...beats("b", 600, (t) => t, { start: T0 + 700_000 }),
      ...beats("c", 600, (t) => t, { start: day2 }),
    ];
    const ev = evaluateSessions(sessions, hb);
    const agg = aggregateQualifiedViews(sessions, ev);
    expect(agg.views.map((v) => v.sessionId)).toEqual(["a", "c"]);
    expect(agg.anomalies[0]?.reason).toBe("repeat same day");
  });

  it("child profile activity is credited under the same rules", () => {
    const s = session({ profileId: "child-1", durationSec: 300 });
    const e = evaluateSession(s, beats("s1", 300, (t) => t));
    expect(e.qualifies).toBe(true);
    expect(e.creditedSec).toBe(300);
  });
});
