"use client";

import { useState } from "react";
import { AGE_BAND_LABEL, AGE_BANDS, CATEGORY_LABEL, type AgeBand, type CategoryId, type Instructor, type Intensity, type Workout } from "@app/domain";
import { rowToVideo, rowToWorkout, type VideoInfo, type WorkoutRow } from "@/lib/catalog-db";
import { friendlyError, supabase } from "@/lib/supabase";

const INTENSITIES: Intensity[] = ["gentle", "moderate", "energetic"];
const EQUIPMENT = ["none", "mat", "ball", "chair", "wall", "light-weights"] as const;

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "workout";

/**
 * Create a new workout (always starts as a draft) or edit an existing one's details.
 * The video, captions and rights checklist are handled on the workout's row once it exists.
 */
export function WorkoutEditor({
  workout,
  instructors,
  onSaved,
  onCancel,
}: {
  workout?: Workout;
  instructors: Instructor[];
  onSaved: (w: Workout, v: VideoInfo) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    title: workout?.title ?? "",
    description: workout?.description ?? "",
    instructorId: workout?.instructorId ?? instructors[0]?.id ?? "",
    category: (workout?.category ?? "move-and-play") as CategoryId,
    minutes: workout ? String(Math.round(workout.durationSec / 60)) : "10",
    intensity: (workout?.intensity ?? "gentle") as Intensity,
    ageBands: new Set<AgeBand>(workout?.ageBands ?? []),
    equipment: new Set<string>(workout?.equipment ?? ["none"]),
    accessibility: workout?.accessibilityNotes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const minutes = Number(f.minutes);
    if (!f.title.trim()) return setError("Give the workout a title.");
    if (!f.instructorId) return setError("Choose the coach.");
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) return setError("Length must be 1–120 minutes.");
    if (f.ageBands.size === 0) return setError("Choose at least one age group.");
    const ins = instructors.find((i) => i.id === f.instructorId)!;
    const row: Record<string, unknown> = {
      title: f.title.trim(),
      description: f.description.trim(),
      instructor_id: ins.id,
      creator_id: ins.creatorId,
      category: f.category,
      duration_sec: Math.round(minutes * 60),
      intensity: f.intensity,
      age_bands: AGE_BANDS.filter((b) => f.ageBands.has(b)),
      equipment: [...f.equipment],
      accessibility_notes: f.accessibility.trim() || null,
      rights_guardian_consent: ins.isMinor ? (workout?.rights.guardianConsent === true) : null,
    };
    setBusy(true);
    const db = supabase();
    let res;
    if (workout) {
      res = await db.from("workouts").update(row).eq("id", workout.id).select("*").single();
    } else {
      // Unique web address: add a number if the title is already used.
      const base = slugify(f.title);
      const { data: taken } = await db.from("workouts").select("slug").like("slug", `${base}%`);
      const used = new Set((taken ?? []).map((t) => t.slug as string));
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      res = await db.from("workouts").insert({ ...row, slug, state: "draft" }).select("*").single();
    }
    setBusy(false);
    if (res.error) return setError(friendlyError(res.error));
    onSaved(rowToWorkout(res.data as WorkoutRow), rowToVideo(res.data as WorkoutRow));
  }

  const field = "mt-1 block w-full rounded border border-ink/20 bg-white px-2 py-1.5";
  if (instructors.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 text-sm ring-1 ring-ink/10">
        No coaches yet. Add the creator first under <a href="/admin/creators/" className="underline">Creators & contracts → New creator</a>.
        <button type="button" onClick={onCancel} className="ml-3 underline">Close</button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-ink/10 sm:grid-cols-2">
      <div className="font-semibold sm:col-span-2">{workout ? `Edit “${workout.title}”` : "New workout"}</div>
      <label className="sm:col-span-2">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} className={field} /></label>
      <label className="sm:col-span-2">Description (what families will do)<textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} maxLength={400} className={field} /></label>
      <label>Coach
        <select value={f.instructorId} onChange={(e) => setF({ ...f, instructorId: e.target.value })} className={field}>
          {instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}{i.isMinor ? " (under 18)" : ""}</option>)}
        </select>
      </label>
      <label>Category
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as CategoryId })} className={field}>
          {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </label>
      <label>Length (minutes)<input value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" className={field} /></label>
      <label>Intensity
        <select value={f.intensity} onChange={(e) => setF({ ...f, intensity: e.target.value as Intensity })} className={field}>
          {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend>Suitable for</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {AGE_BANDS.map((b) => (
            <label key={b} className="flex items-center gap-1.5"><input type="checkbox" checked={f.ageBands.has(b)} onChange={() => setF({ ...f, ageBands: toggle(f.ageBands, b) as Set<AgeBand> })} />{AGE_BAND_LABEL[b]}</label>
          ))}
          <button type="button" onClick={() => setF({ ...f, ageBands: new Set(AGE_BANDS) })} className="text-xs underline">all ages</button>
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend>Equipment</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {EQUIPMENT.map((q) => (
            <label key={q} className="flex items-center gap-1.5"><input type="checkbox" checked={f.equipment.has(q)} onChange={() => setF({ ...f, equipment: toggle(f.equipment, q) })} />{q}</label>
          ))}
        </div>
      </fieldset>
      <label className="sm:col-span-2">Safety & accessibility notes (optional)<input value={f.accessibility} onChange={(e) => setF({ ...f, accessibility: e.target.value })} maxLength={200} placeholder="e.g. Seated option shown throughout" className={field} /></label>
      {error && <p role="alert" className="text-[#b8361a] sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">{busy ? "Saving…" : workout ? "Save changes" : "Create draft"}</button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Cancel</button>
        {!workout && <span className="self-center text-xs text-ink/50">Next: upload the video, tick the rights checklist, then send it for review.</span>}
      </div>
    </form>
  );
}
