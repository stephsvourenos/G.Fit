"use client";

import { Fragment, useEffect, useState } from "react";
import { AGE_BAND_LABEL, canPublish, CATEGORY_LABEL, CONTENT_STATES, formatDuration, type ContentState, type Instructor, type Workout } from "@app/domain";
import { instructors as seedInstructors, workouts as seed } from "@app/mock-data";
import { Badge, Table } from "@/components/AdminShell";
import { loadCatalogForAdmin, rowToVideo, rowToWorkout, workoutPatch, type VideoInfo, type WorkoutRow } from "@/lib/catalog-db";
import { VideoPanel, VideoBadge } from "./VideoPanel";
import { WorkoutEditor } from "./WorkoutEditor";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

const NEXT: Partial<Record<ContentState, ContentState>> = {
  draft: "uploaded",
  uploaded: "awaiting-review",
  "awaiting-review": "approved",
  approved: "published",
  scheduled: "published",
  published: "archived",
};
const TONE: Record<ContentState, "grey" | "green" | "amber" | "red" | "blue"> = {
  draft: "grey", uploaded: "grey", "awaiting-review": "amber", approved: "blue", scheduled: "blue", published: "green", archived: "grey",
};

export function ContentBoard() {
  const live = supabaseConfigured;
  const [items, setItems] = useState<Workout[]>(live ? [] : seed);
  const [instructors, setInstructors] = useState<Instructor[]>(live ? [] : seedInstructors);
  const [loading, setLoading] = useState(live);
  const [filter, setFilter] = useState<ContentState | "all">("all");
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [videos, setVideos] = useState<Record<string, VideoInfo>>({});
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const saved = (w: Workout, v: VideoInfo) => {
    setItems((list) => (list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [w, ...list]));
    setVideos((all) => ({ ...all, [w.id]: v }));
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${editing === "new" ? "created draft" : "updated"} “${w.title}”`, ...l]);
    setEditing(null);
    setOpen(w.id);
  };
  /** Video must be uploaded and ready before going live (the database checks this too). */
  const videoProblem = (id: string) => (live && videos[id]?.status !== "ready" ? ["Video not uploaded and ready yet"] : []);

  useEffect(() => {
    if (!live) return;
    loadCatalogForAdmin()
      .then((c) => {
        setItems(c.workouts);
        setInstructors(c.instructors);
        setVideos(c.videos);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [live]);

  async function update(id: string, change: Partial<Workout>, note: string) {
    setError(undefined);
    if (!live) {
      setItems((list) => list.map((w) => (w.id === id ? { ...w, ...change } : w)));
      setLog((l) => [`${new Date().toLocaleTimeString()} — demo: ${note}`, ...l]);
      return;
    }
    // The database re-checks everything: staff role, and the publishing rules.
    setBusyId(id);
    const { data, error } = await supabase().from("workouts").update(workoutPatch(change)).eq("id", id).select("*").single();
    setBusyId(undefined);
    if (error) return setError(friendlyError(error).replace(/^Cannot publish:/, "Can’t publish:"));
    const saved = rowToWorkout(data as WorkoutRow);
    setVideos((v) => ({ ...v, [id]: rowToVideo(data as WorkoutRow) }));
    setItems((list) => list.map((w) => (w.id === id ? saved : w)));
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${note} (saved; recorded in the audit log)`, ...l]);
  }

  if (loading) return <p className="text-ink/60">Loading the catalogue…</p>;

  const shown = items.filter((w) => filter === "all" || w.state === filter);
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{error}</p>}
      {live && (
        <div className="mb-4">
          {editing === "new" ? (
            <WorkoutEditor instructors={instructors} onSaved={saved} onCancel={() => setEditing(null)} />
          ) : (
            <button onClick={() => setEditing("new")} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">+ New workout</button>
          )}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...CONTENT_STATES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-sm ${filter === s ? "bg-ink text-paper" : "bg-white ring-1 ring-ink/10"}`}>
            {s} {s !== "all" && <span className="opacity-60">({items.filter((w) => w.state === s).length})</span>}
          </button>
        ))}
      </div>
      <Table head={["Workout", "Instructor", "Ages", "Status", "Checks", ...(live ? ["Video"] : []), ""]}>
        {shown.map((w) => {
          const ins = instructors.find((i) => i.id === w.instructorId);
          if (!ins) return null;
          const check = canPublish({ ...w, state: w.state === "published" ? "approved" : w.state }, ins);
          const next = NEXT[w.state];
          const blocked = next === "published" && (!canPublish(w, ins).ok || videoProblem(w.id).length > 0);
          return (
            <Fragment key={w.id}>
              <tr className="align-top">
                <td className="px-4 py-3">
                  <button onClick={() => setOpen(open === w.id ? null : w.id)} className="text-left font-semibold hover:underline">{w.title}</button>
                  <div className="text-xs text-ink/50">{CATEGORY_LABEL[w.category]} · {formatDuration(w.durationSec)} · {w.intensity}</div>
                </td>
                <td className="px-4 py-3">{ins.displayName}{ins.isMinor && <div><Badge tone="amber">minor</Badge></div>}</td>
                <td className="px-4 py-3 text-xs">{w.ageBands.map((b) => AGE_BAND_LABEL[b]).join(", ")}</td>
                <td className="px-4 py-3"><Badge tone={TONE[w.state]}>{w.state}</Badge>{w.publishedAt && <div className="mt-1 text-xs text-ink/50">{w.publishedAt}</div>}</td>
                <td className="px-4 py-3">{check.ok || w.state === "archived" ? <Badge tone="green">all clear</Badge> : <Badge tone="red">{check.problems.filter((p) => !p.startsWith("Must be")).length} issue(s)</Badge>}</td>
                {live && <td className="px-4 py-3"><VideoBadge v={videos[w.id]} /></td>}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {next && (
                    <button
                      disabled={blocked || busyId === w.id}
                      title={blocked ? [...canPublish(w, ins).problems, ...videoProblem(w.id)].join("\n") : ""}
                      onClick={() => update(w.id, { state: next, publishedAt: next === "published" ? new Date().toISOString().slice(0, 10) : w.publishedAt }, `${w.title}: ${w.state} → ${next}`)}
                      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:bg-ink/20"
                    >
                      {next === "published" ? "Publish" : next === "archived" ? "Archive" : `Move to ${next}`}
                    </button>
                  )}
                </td>
              </tr>
              {open === w.id && (
                <tr>
                  <td colSpan={live ? 7 : 6} className="bg-ink/[0.02] px-4 py-4">
                    {live && (editing === w.id ? (
                      <div className="mb-4"><WorkoutEditor workout={w} instructors={instructors} onSaved={saved} onCancel={() => setEditing(null)} /></div>
                    ) : (
                      <button onClick={() => setEditing(w.id)} className="mb-3 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/20">Edit details</button>
                    ))}
                    <div className="grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <div className="font-semibold">Rights & safety checklist</div>
                        {([
                          ["creatorLicenceSigned", "Creator licence signed"],
                          ["musicCleared", "Music sync & master rights cleared"],
                          ["safetyReviewed", "External safety review completed"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="mt-2 flex items-center gap-2">
                            <input type="checkbox" disabled={busyId === w.id} checked={w.rights[k]} onChange={(e) => update(w.id, { rights: { ...w.rights, [k]: e.target.checked } }, `${w.title}: ${label} = ${e.target.checked}`)} />
                            {label}
                          </label>
                        ))}
                        {ins.isMinor && (
                          <label className="mt-2 flex items-center gap-2">
                            <input type="checkbox" disabled={busyId === w.id} checked={w.rights.guardianConsent === true} onChange={(e) => update(w.id, { rights: { ...w.rights, guardianConsent: e.target.checked } }, `${w.title}: guardian consent = ${e.target.checked}`)} />
                            Guardian consent & child-employment requirements on file
                          </label>
                        )}
                        <div className="mt-2 text-xs text-ink/50">Territories: {w.rights.territories.join(", ")}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Publishing blockers</div>
                        <ul className="mt-2 list-disc pl-5 text-ink/70">
                          {[...canPublish({ ...w, state: "approved" }, ins).problems, ...videoProblem(w.id)].map((p) => <li key={p}>{p}</li>)}
                          {canPublish({ ...w, state: "approved" }, ins).ok && videoProblem(w.id).length === 0 && <li>None — ready to publish once approved.</li>}
                        </ul>
                        {live ? (
                          <VideoPanel
                            workoutId={w.id}
                            title={w.title}
                            v={videos[w.id]}
                            onChange={(v) => {
                              setVideos((all) => ({ ...all, [w.id]: v }));
                              if (v.captions !== undefined) setItems((list) => list.map((x) => (x.id === w.id ? { ...x, captions: v.captions! } : x)));
                            }}
                          />
                        ) : (
                          <p className="mt-3 text-xs text-ink/50">Video uploads work once the app is connected to Mux.</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
      {log.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 text-xs ring-1 ring-ink/5">
          <div className="mb-2 font-semibold uppercase tracking-wide text-ink/50">Your changes this session</div>
          {log.map((l, i) => <div key={i} className="font-mono">{l}</div>)}
        </div>
      )}
    </>
  );
}
