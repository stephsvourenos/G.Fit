/**
 * Qualified-playback engine.
 *
 * The player sends a small "heartbeat" every ~10–15 seconds with its current
 * position and state. The server never trusts the client's claim of "watched
 * the whole thing" — it rebuilds which parts of the video were genuinely
 * played in real time, and only credits those.
 *
 * This measures qualified PLAYBACK, not physical exercise.
 */

export interface PlaybackSession {
  sessionId: string;
  householdId: string;
  /** Pseudonymous profile ID — never a name. */
  profileId: string;
  workoutId: string;
  creatorId: string;
  deviceId: string;
  durationSec: number;
  /** Server issued a signed playback token for this profile + workout. */
  tokenIssued: boolean;
  /** Profile has accessibility mode on (lower completion threshold). */
  accessibilityMode: boolean;
  /** Server time the session was opened (epoch ms). */
  startedAt: number;
}

export interface Heartbeat {
  sessionId: string;
  /** Strictly increasing per session; duplicates/replays are dropped. */
  seq: number;
  /** Server receive time (epoch ms). Client clocks are not trusted. */
  receivedAt: number;
  positionSec: number;
  playing: boolean;
  /** Player is in the foreground / tab visible (where the platform reports it). */
  visible: boolean;
  buffering: boolean;
  playbackRate: number;
}

export interface PlaybackPolicy {
  version: string;
  /** Default share of the video that must be genuinely watched. */
  defaultFraction: number;
  /** Stricter thresholds for short videos (checked in order). */
  shortVideoRules: Array<{ maxDurationSec: number; fraction: number }>;
  /** Threshold when the profile uses accessibility mode. */
  accessibilityFraction: number;
  /** Longest gap between heartbeats that still counts as continuous playback. */
  maxHeartbeatGapSec: number;
  /** Position may not advance faster than this multiple of real time (+ tolerance). */
  maxPlaybackRate: number;
  seekToleranceSec: number;
  /** Credits per profile per workout per calendar day. */
  maxCreditsPerWorkoutPerDay: number;
  /** Credits per profile per workout per month (genuine repeats on separate days). */
  maxCreditsPerWorkoutPerMonth: number;
  /** Hard cap on credited seconds per profile per month; excess is flagged for review. */
  profileMonthlyCapSec: number;
  /** Simultaneous streams per household that can earn credit. */
  maxConcurrentStreamsPerHousehold: number;
  timeZone: string;
}

export const DEFAULT_PLAYBACK_POLICY: PlaybackPolicy = {
  version: "playback-v1",
  defaultFraction: 0.7,
  shortVideoRules: [
    { maxDurationSec: 120, fraction: 0.85 },
    { maxDurationSec: 300, fraction: 0.8 },
  ],
  accessibilityFraction: 0.5,
  maxHeartbeatGapSec: 45,
  maxPlaybackRate: 1.25,
  seekToleranceSec: 2,
  maxCreditsPerWorkoutPerDay: 1,
  maxCreditsPerWorkoutPerMonth: 8,
  profileMonthlyCapSec: 30 * 3600,
  maxConcurrentStreamsPerHousehold: 4,
  timeZone: "Australia/Sydney",
};

export function requiredFraction(durationSec: number, accessibilityMode: boolean, p: PlaybackPolicy): number {
  if (accessibilityMode) return p.accessibilityFraction;
  for (const rule of p.shortVideoRules) {
    if (durationSec <= rule.maxDurationSec) return rule.fraction;
  }
  return p.defaultFraction;
}

export type PlaybackFlag =
  | "no-playback-token"
  | "duplicate-heartbeat"
  | "out-of-order-heartbeat"
  | "seek-detected"
  | "gap-too-long"
  | "background-or-paused"
  | "buffering"
  | "concurrency-limit"
  | "duplicate-profile-stream";

interface Interval {
  start: number;
  end: number;
}

/** A credited slice of playback: position range plus when it happened. */
export interface CreditedSegment {
  pos: Interval;
  wall: Interval;
}

export interface SessionEvaluation {
  sessionId: string;
  segments: CreditedSegment[];
  distinctWatchedSec: number;
  coverage: number;
  requiredFraction: number;
  qualifies: boolean;
  creditedSec: number;
  flags: PlaybackFlag[];
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

function intervalTotal(list: Interval[]): number {
  return mergeIntervals(list).reduce((acc, i) => acc + (i.end - i.start), 0);
}

/** Rebuild the genuinely-played segments of one session from its heartbeats. */
export function extractSegments(
  session: PlaybackSession,
  heartbeats: Heartbeat[],
  p: PlaybackPolicy,
): { segments: CreditedSegment[]; flags: Set<PlaybackFlag> } {
  const flags = new Set<PlaybackFlag>();
  if (!session.tokenIssued) {
    flags.add("no-playback-token");
    return { segments: [], flags };
  }

  // Drop replays/duplicates and anything whose server time runs backwards.
  const bySeq = [...heartbeats].filter((h) => h.sessionId === session.sessionId).sort((a, b) => a.seq - b.seq);
  const clean: Heartbeat[] = [];
  for (const h of bySeq) {
    const last = clean[clean.length - 1];
    if (last && h.seq === last.seq) {
      flags.add("duplicate-heartbeat");
      continue;
    }
    if (last && h.receivedAt <= last.receivedAt) {
      flags.add("out-of-order-heartbeat");
      continue;
    }
    clean.push(h);
  }

  const segments: CreditedSegment[] = [];
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1]!;
    const b = clean[i]!;
    const wallSec = (b.receivedAt - a.receivedAt) / 1000;
    const advanced = b.positionSec - a.positionSec;
    if (advanced <= 0) continue; // paused in place or seeked backwards: nothing new played
    if (wallSec > p.maxHeartbeatGapSec) {
      flags.add("gap-too-long");
      continue;
    }
    if (!a.playing || !b.playing || !a.visible || !b.visible) {
      flags.add("background-or-paused");
      continue;
    }
    if (a.buffering || b.buffering) {
      flags.add("buffering");
      continue;
    }
    if (advanced > wallSec * p.maxPlaybackRate + p.seekToleranceSec) {
      flags.add("seek-detected");
      continue;
    }
    const start = Math.max(0, Math.min(a.positionSec, session.durationSec));
    const end = Math.max(0, Math.min(b.positionSec, session.durationSec));
    if (end > start) segments.push({ pos: { start, end }, wall: { start: a.receivedAt, end: b.receivedAt } });
  }
  return { segments, flags };
}

function evaluate(session: PlaybackSession, segments: CreditedSegment[], flags: Set<PlaybackFlag>, p: PlaybackPolicy): SessionEvaluation {
  const distinct = intervalTotal(segments.map((s) => s.pos));
  const coverage = session.durationSec > 0 ? distinct / session.durationSec : 0;
  const required = requiredFraction(session.durationSec, session.accessibilityMode, p);
  const qualifies = coverage + 1e-9 >= required;
  return {
    sessionId: session.sessionId,
    segments,
    distinctWatchedSec: Math.round(distinct),
    coverage,
    requiredFraction: required,
    qualifies,
    // Credit only what was distinctly watched — never the full video length.
    creditedSec: qualifies ? Math.round(distinct) : 0,
    flags: [...flags],
  };
}

export function evaluateSession(session: PlaybackSession, heartbeats: Heartbeat[], p = DEFAULT_PLAYBACK_POLICY): SessionEvaluation {
  const { segments, flags } = extractSegments(session, heartbeats, p);
  return evaluate(session, segments, flags, p);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Evaluate many sessions together so that concurrency rules apply:
 *  - one profile cannot earn from two streams at the same moment;
 *  - a household cannot earn from more than N simultaneous streams.
 * Earlier-started sessions win; later overlapping segments are dropped.
 */
export function evaluateSessions(
  sessions: PlaybackSession[],
  heartbeats: Heartbeat[],
  p = DEFAULT_PLAYBACK_POLICY,
): SessionEvaluation[] {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt || (a.sessionId < b.sessionId ? -1 : 1));
  const accepted: Array<{ session: PlaybackSession; seg: CreditedSegment }> = [];
  const results: SessionEvaluation[] = [];

  for (const session of ordered) {
    const { segments, flags } = extractSegments(session, heartbeats, p);
    const kept: CreditedSegment[] = [];
    for (const seg of segments) {
      const sameProfile = accepted.some(
        (x) => x.session.profileId === session.profileId && x.session.sessionId !== session.sessionId && overlaps(x.seg.wall, seg.wall),
      );
      if (sameProfile) {
        flags.add("duplicate-profile-stream");
        continue;
      }
      const concurrentSessions = new Set(
        accepted
          .filter((x) => x.session.householdId === session.householdId && x.session.sessionId !== session.sessionId && overlaps(x.seg.wall, seg.wall))
          .map((x) => x.session.sessionId),
      );
      if (concurrentSessions.size >= p.maxConcurrentStreamsPerHousehold) {
        flags.add("concurrency-limit");
        continue;
      }
      kept.push(seg);
      accepted.push({ session, seg });
    }
    results.push(evaluate(session, kept, flags, p));
  }
  return results;
}

export interface QualifiedView {
  householdId: string;
  profileId: string;
  workoutId: string;
  creatorId: string;
  day: string;
  month: string;
  creditedSec: number;
  sessionId: string;
}

export interface AggregationResult {
  views: QualifiedView[];
  /** Sessions whose credit was reduced by a cap — candidates for anomaly review. */
  anomalies: Array<{ profileId: string; reason: string; sessionId: string }>;
}

function dayKey(epochMs: number, timeZone: string): string {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(epochMs));
}

/**
 * Apply repeat-viewing caps and produce the aggregated "qualified views" that
 * feed royalty calculations. Raw heartbeats can be deleted after this step.
 */
export function aggregateQualifiedViews(
  sessions: PlaybackSession[],
  evaluations: SessionEvaluation[],
  p = DEFAULT_PLAYBACK_POLICY,
): AggregationResult {
  const byId = new Map(sessions.map((s) => [s.sessionId, s]));
  const qualifying = evaluations
    .filter((e) => e.qualifies && e.creditedSec > 0)
    .map((e) => ({ e, s: byId.get(e.sessionId)! }))
    .sort((a, b) => a.s.startedAt - b.s.startedAt);

  const perDay = new Map<string, number>();
  const perMonth = new Map<string, number>();
  const profileSeconds = new Map<string, number>();
  const views: QualifiedView[] = [];
  const anomalies: AggregationResult["anomalies"] = [];

  for (const { e, s } of qualifying) {
    const day = dayKey(s.startedAt, p.timeZone);
    const month = day.slice(0, 7);
    const dKey = `${s.profileId}|${s.workoutId}|${day}`;
    const mKey = `${s.profileId}|${s.workoutId}|${month}`;
    const pKey = `${s.profileId}|${month}`;

    if ((perDay.get(dKey) ?? 0) >= p.maxCreditsPerWorkoutPerDay) {
      anomalies.push({ profileId: s.profileId, reason: "repeat same day", sessionId: s.sessionId });
      continue;
    }
    if ((perMonth.get(mKey) ?? 0) >= p.maxCreditsPerWorkoutPerMonth) {
      anomalies.push({ profileId: s.profileId, reason: "monthly repeat cap", sessionId: s.sessionId });
      continue;
    }
    const used = profileSeconds.get(pKey) ?? 0;
    const allowed = Math.max(0, Math.min(e.creditedSec, p.profileMonthlyCapSec - used));
    if (allowed < e.creditedSec) {
      anomalies.push({ profileId: s.profileId, reason: "profile monthly cap", sessionId: s.sessionId });
    }
    if (allowed <= 0) continue;

    perDay.set(dKey, (perDay.get(dKey) ?? 0) + 1);
    perMonth.set(mKey, (perMonth.get(mKey) ?? 0) + 1);
    profileSeconds.set(pKey, used + allowed);
    views.push({
      householdId: s.householdId,
      profileId: s.profileId,
      workoutId: s.workoutId,
      creatorId: s.creatorId,
      day,
      month,
      creditedSec: allowed,
      sessionId: s.sessionId,
    });
  }
  return { views, anomalies };
}
