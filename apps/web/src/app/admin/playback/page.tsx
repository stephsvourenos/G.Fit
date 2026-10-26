import { aggregateQualifiedViews, evaluateSessions, type Heartbeat, type PlaybackSession } from "@app/domain";
import { Badge, PageHeader, Table } from "@/components/AdminShell";

/** A handful of simulated sessions, scored by the real rules, to populate the alert queue. */
function demoAlerts() {
  const T = Date.UTC(2026, 9, 20, 9, 0, 0);
  const base = { durationSec: 600, tokenIssued: true, accessibilityMode: false, creatorId: "cr-pip", workoutId: "wk-first-touch-footwork" };
  const sessions: PlaybackSession[] = [
    { ...base, sessionId: "S-1041", householdId: "hh-nguyen", profileId: "p-7f2a", deviceId: "ios-1", startedAt: T },
    { ...base, sessionId: "S-1042", householdId: "hh-smith", profileId: "p-91bd", deviceId: "web-1", startedAt: T },
    { ...base, sessionId: "S-1043", householdId: "hh-kelly", profileId: "p-3c10", deviceId: "and-1", startedAt: T },
    { ...base, sessionId: "S-1044", householdId: "hh-kelly", profileId: "p-3c10", deviceId: "and-2", startedAt: T + 5000 },
    { ...base, sessionId: "S-1045", householdId: "hh-rossi", profileId: "p-aa01", deviceId: "web-2", startedAt: T },
  ];
  const beats = (id: string, start: number, pos: (t: number) => number, extra: (t: number) => Partial<Heartbeat> = () => ({})) =>
    Array.from({ length: 51 }, (_, i) => ({ sessionId: id, seq: i, receivedAt: start + i * 12000, positionSec: pos(i * 12), playing: true, visible: true, buffering: false, playbackRate: 1, ...extra(i * 12) }));
  const hb = [
    ...beats("S-1041", T, (t) => t),
    ...beats("S-1042", T, (t) => (t < 36 ? t : Math.min(600, 560 + t))),
    ...beats("S-1043", T, (t) => t),
    ...beats("S-1044", T + 5000, (t) => t),
    ...beats("S-1045", T, (t) => t, () => ({ visible: false })),
  ];
  const ev = evaluateSessions(sessions, hb);
  const agg = aggregateQualifiedViews(sessions, ev);
  return { ev, agg, sessions };
}

export default function PlaybackPage() {
  const { ev, sessions } = demoAlerts();
  return (
    <>
      <PageHeader title="Playback & fraud alerts" sub="Qualified minutes are rebuilt on the server from 12-second heartbeats. Skips, background play, duplicate streams and replayed heartbeats earn nothing. This measures playback — it cannot prove exercise." />
      <Table head={["Session", "Profile (pseudonymous)", "Device", "Watched", "Coverage", "Credited", "Flags"]}>
        {ev.map((e) => {
          const s = sessions.find((x) => x.sessionId === e.sessionId)!;
          return (
            <tr key={e.sessionId}>
              <td className="px-4 py-3 font-mono text-xs">{e.sessionId}</td>
              <td className="px-4 py-3 font-mono text-xs">{s.profileId}</td>
              <td className="px-4 py-3 text-xs">{s.deviceId}</td>
              <td className="px-4 py-3">{Math.round(e.distinctWatchedSec / 60)} min</td>
              <td className="px-4 py-3">{Math.round(e.coverage * 100)}%</td>
              <td className="px-4 py-3">{e.qualifies ? <Badge tone="green">{Math.round(e.creditedSec / 60)} min</Badge> : <Badge tone="red">0</Badge>}</td>
              <td className="px-4 py-3 text-xs">{e.flags.length ? e.flags.join(", ") : "—"}</td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-4 text-xs text-ink/50">Raw heartbeats are kept for 90 days (proposed) and then deleted; only the aggregated qualified minutes are retained for royalty audits.</p>
    </>
  );
}
