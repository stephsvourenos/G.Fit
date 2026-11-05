"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface SessionRow {
  id: string;
  profile_id: string;
  device_id: string;
  started_at: string;
  last_heartbeat_at: string | null;
  evaluated_at: string | null;
  duration_sec: number;
  distinct_watched_sec: number | null;
  coverage: number | null;
  qualifies: boolean | null;
  credited_sec: number | null;
  flags: string[] | null;
  workouts: { title: string } | null;
}

const short = (id: string) => id.slice(0, 8);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
const mins = (sec: number) => (sec < 120 ? `${sec}s` : `${Math.round(sec / 60)} min`);

const fetchSessions = () =>
  supabase()
    .from("playback_sessions")
    .select(
      "id, profile_id, device_id, started_at, last_heartbeat_at, evaluated_at, duration_sec, distinct_watched_sec, coverage, qualifies, credited_sec, flags, workouts(title)",
    )
    .order("started_at", { ascending: false })
    .limit(200);

/**
 * Real playback sessions from the database (admin/finance only). Results are
 * filled in by the scheduled job every 15 minutes, once a session has been
 * quiet for 10 minutes; "Score now" runs it immediately.
 */
export function LivePlayback({ demo }: { demo: ReactNode }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string>();

  const load = useCallback(
    () =>
      fetchSessions().then(({ data, error }) => {
        if (error) setError(friendlyError(error));
        else setRows((data ?? []) as unknown as SessionRow[]);
      }),
    [],
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchSessions().then(({ data, error }) => {
      if (error) setError(friendlyError(error));
      else setRows((data ?? []) as unknown as SessionRow[]);
    });
  }, []);

  if (!supabaseConfigured) return <>{demo}</>;

  const scoreNow = async () => {
    setRunning(true);
    setNote(undefined);
    const { data, error } = await supabase().functions.invoke("aggregate-playback", { body: { now: true } });
    setRunning(false);
    if (error) return setNote("Couldn't run scoring — only admin and finance staff can do this.");
    setNote(`Scored ${data.sessionsEvaluated} session(s); ${data.qualifiedViews} qualified view(s) this period.`);
    void load();
  };

  const flagged = rows?.filter((r) => (r.flags ?? []).some((f) => f !== "buffering" && f !== "background-or-paused")) ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={scoreNow}
          disabled={running}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {running ? "Scoring…" : "Score now"}
        </button>
        <span className="text-sm text-ink/60">
          Runs automatically every 15 minutes. {flagged.length > 0 && <strong className="text-[#b8361a]">{flagged.length} flagged</strong>}
        </span>
        {note && <span className="text-sm text-ink/70">{note}</span>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{error}</p>}
      {!rows && !error && <p className="text-ink/60">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No videos have been played yet. Sessions appear here as soon as a family presses play.</p>
      )}
      {rows && rows.length > 0 && (
        <Table head={["Started (Sydney)", "Workout", "Profile (pseudonymous)", "Device", "Watched", "Coverage", "Credited", "Flags"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-xs">{when(r.started_at)}</td>
              <td className="px-4 py-3 text-sm">{r.workouts?.title ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs">{short(r.profile_id)}</td>
              <td className="px-4 py-3 font-mono text-xs">{short(r.device_id)}</td>
              <td className="px-4 py-3">{r.distinct_watched_sec != null ? mins(r.distinct_watched_sec) : "—"}</td>
              <td className="px-4 py-3">{r.coverage != null ? `${Math.round(Number(r.coverage) * 100)}%` : "—"}</td>
              <td className="px-4 py-3">
                {!r.evaluated_at ? (
                  <Badge tone="amber">{r.last_heartbeat_at ? "Pending" : "No heartbeats"}</Badge>
                ) : r.qualifies ? (
                  <Badge tone="green">{mins(r.credited_sec ?? 0)}</Badge>
                ) : (
                  <Badge tone="red">0</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-xs">{r.flags?.length ? r.flags.join(", ").replaceAll("-", " ") : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
