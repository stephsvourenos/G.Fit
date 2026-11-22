"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDuration, type Instructor, type Workout } from "@app/domain";
import { instructors as seedInstructors, programs as seedProgrammes, workouts as seedWorkouts } from "@app/mock-data";
import { Badge, Table } from "@/components/AdminShell";
import { loadCatalogForAdmin } from "@/lib/catalog-db";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

type State = "draft" | "published" | "archived";
interface Programme {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructorId: string | null;
  state: State;
  thumbnail: { from?: string; to?: string; emoji?: string };
  workoutIds: string[];
}

const TONE: Record<State, "grey" | "green"> = { draft: "grey", published: "green", archived: "grey" };
const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "programme";

const seed: Programme[] = seedProgrammes.map((p) => ({
  id: p.id, slug: p.id.replace(/^pg-/, ""), title: p.title, description: p.blurb, instructorId: null, state: "published",
  thumbnail: { emoji: p.emoji }, workoutIds: p.workoutIds,
}));

/** Programmes: an ordered series of workouts. Everything is included in the membership; there is no price field on purpose. */
export function ProgrammeBoard() {
  const live = supabaseConfigured;
  const [items, setItems] = useState<Programme[]>(live ? [] : seed);
  const [workouts, setWorkouts] = useState<Workout[]>(live ? [] : seedWorkouts);
  const [instructors, setInstructors] = useState<Instructor[]>(live ? [] : seedInstructors);
  const [loading, setLoading] = useState(live);
  const [editing, setEditing] = useState<Programme | null>(null);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    Promise.all([
      loadCatalogForAdmin(),
      supabase().from("programmes").select("*, programme_workouts(position, workout_id)").order("created_at", { ascending: false }),
    ])
      .then(([c, p]) => {
        if (p.error) throw p.error;
        setWorkouts(c.workouts);
        setInstructors(c.instructors);
        /* eslint-disable @typescript-eslint/no-explicit-any */
        setItems((p.data ?? []).map((r: any) => ({
          id: r.id, slug: r.slug, title: r.title, description: r.description, instructorId: r.instructor_id, state: r.state,
          thumbnail: r.thumbnail ?? {},
          workoutIds: [...(r.programme_workouts ?? [])].sort((a: any, b: any) => a.position - b.position).map((x: any) => x.workout_id),
        })));
        /* eslint-enable @typescript-eslint/no-explicit-any */
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [live]);

  const wById = useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts]);
  const insName = (id: string | null) => instructors.find((i) => i.id === id)?.displayName ?? "—";
  const liveCount = (p: Programme) => p.workoutIds.filter((id) => wById.get(id)?.state === "published").length;

  async function setState(p: Programme, state: State) {
    setError(undefined);
    if (!live) { setItems((l) => l.map((x) => (x.id === p.id ? { ...x, state } : x))); setNote(`Demo: “${p.title}” is now ${state}.`); return; }
    setBusy(true);
    const { error } = await supabase().from("programmes").update({ state }).eq("id", p.id);
    setBusy(false);
    if (error) return setError(friendlyError(error).replace(/^Cannot publish:/, "Can’t publish:"));
    setItems((l) => l.map((x) => (x.id === p.id ? { ...x, state } : x)));
    setNote(`“${p.title}” is now ${state} (recorded in the audit log).`);
  }

  async function save(p: Programme) {
    setError(undefined);
    if (!p.title.trim()) return setError("Give the programme a title.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) return setError("The web address can use lowercase letters, numbers and dashes only.");
    if (!live) {
      setItems((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [p, ...l]));
      setEditing(null); setNote(`Demo: saved “${p.title}”.`); return;
    }
    setBusy(true);
    const row = { slug: p.slug, title: p.title.trim(), description: p.description.trim(), instructor_id: p.instructorId, thumbnail: p.thumbnail };
    const isNew = !items.some((x) => x.id === p.id);
    const res = isNew
      ? await supabase().from("programmes").insert(row).select("id").single()
      : await supabase().from("programmes").update(row).eq("id", p.id).select("id").single();
    if (res.error) { setBusy(false); return setError(friendlyError(res.error).includes("duplicate") ? "Another programme already uses that web address." : friendlyError(res.error)); }
    const id = res.data.id as string;
    const order = await supabase().rpc("set_programme_workouts", { p_programme: id, p_workouts: p.workoutIds });
    setBusy(false);
    if (order.error) return setError(friendlyError(order.error));
    const saved = { ...p, id, state: isNew ? "draft" as State : p.state };
    setItems((l) => (isNew ? [saved, ...l] : l.map((x) => (x.id === p.id ? saved : x))));
    setEditing(null);
    setNote(`Saved “${p.title}”.`);
  }

  if (loading) return <p className="text-ink/60">Loading programmes…</p>;

  if (editing) return <Editor p={editing} workouts={workouts} instructors={instructors} busy={busy} error={error} onSave={save} onCancel={() => { setEditing(null); setError(undefined); }} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setEditing({ id: crypto.randomUUID(), slug: "", title: "", description: "", instructorId: null, state: "draft", thumbnail: { emoji: "📅", from: "#2e2a3b", to: "#e0177a" }, workoutIds: [] })}
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">+ New programme</button>
        {!live && <span className="text-sm text-ink/60">Sample data: changes aren’t saved.</span>}
      </div>
      {error && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-ink">{error}</p>}
      {note && <p className="rounded-xl bg-mint/15 px-4 py-3 text-sm text-ink">{note}</p>}
      <Table head={["Programme", "Status", "Sessions (live / total)", "Coach", ""]}>
        {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-ink/60">No programmes yet. Create one, add workouts in order, then publish.</td></tr>}
        {items.map((p) => (
          <tr key={p.id} className="border-t border-ink/5">
            <td className="px-4 py-3"><div className="font-semibold">{p.thumbnail.emoji} {p.title}</div><div className="text-xs text-ink/50">/programmes/{p.slug}/</div></td>
            <td className="px-4 py-3"><Badge tone={TONE[p.state]}>{p.state}</Badge></td>
            <td className="px-4 py-3">{liveCount(p)} / {p.workoutIds.length}</td>
            <td className="px-4 py-3">{insName(p.instructorId)}</td>
            <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
              <button onClick={() => setEditing(p)} className="rounded-full px-3 py-1 ring-1 ring-ink/15">Edit</button>
              {p.state !== "published" && <button disabled={busy} onClick={() => setState(p, "published")} className="rounded-full bg-ink px-3 py-1 text-paper disabled:opacity-50">Publish</button>}
              {p.state === "published" && <button disabled={busy} onClick={() => setState(p, "draft")} className="rounded-full px-3 py-1 ring-1 ring-ink/15">Unpublish</button>}
              {p.state !== "archived" && <button disabled={busy} onClick={() => setState(p, "archived")} className="rounded-full px-3 py-1 text-ink/60 ring-1 ring-ink/10">Archive</button>}
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-sm text-ink/60">
        A programme can go live once it has at least one published workout. Only published workouts appear to members and on the website,
        so a draft workout in a programme stays hidden until it’s published. Every programme is included in the membership.
      </p>
    </div>
  );
}

function Editor({ p, workouts, instructors, busy, error, onSave, onCancel }: {
  p: Programme; workouts: Workout[]; instructors: Instructor[]; busy: boolean; error?: string; onSave: (p: Programme) => void; onCancel: () => void;
}) {
  const [f, setF] = useState(p);
  const [slugTouched, setSlugTouched] = useState(Boolean(p.slug));
  const [pick, setPick] = useState("");
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const available = workouts.filter((w) => !f.workoutIds.includes(w.id) && w.state !== "archived");
  const move = (i: number, d: -1 | 1) => setF((x) => {
    const ids = [...x.workoutIds]; const j = i + d;
    if (j < 0 || j >= ids.length) return x;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    return { ...x, workoutIds: ids };
  });
  const input = "mt-1.5 w-full rounded-xl border border-ink/15 px-3 py-2.5 font-normal";
  const total = f.workoutIds.reduce((t, id) => t + (byId.get(id)?.durationSec ?? 0), 0);

  return (
    <form className="max-w-3xl space-y-5 rounded-2xl bg-white p-6 ring-1 ring-ink/10" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <h2 className="font-display text-2xl">{p.title ? `Edit “${p.title}”` : "New programme"}</h2>
      <label className="block text-sm font-semibold">Title
        <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) })} required />
      </label>
      <label className="block text-sm font-semibold">Web address
        <div className="mt-1.5 flex items-center gap-1 text-ink/60">/programmes/<input className="flex-1 rounded-xl border border-ink/15 px-3 py-2.5 font-normal text-ink" value={f.slug}
          onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase() }); }} required />/</div>
        <span className="text-xs font-normal text-ink/50">Keep it the same once published, so links and search results keep working.</span>
      </label>
      <label className="block text-sm font-semibold">Description
        <textarea className={`${input} min-h-24`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What members will get out of it, and how to follow it." />
      </label>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="block text-sm font-semibold">Coach (optional)
          <select className={input} value={f.instructorId ?? ""} onChange={(e) => setF({ ...f, instructorId: e.target.value || null })}>
            <option value="">G.Fit coaches (several)</option>
            {instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}{i.isMinor ? " (junior, not named publicly)" : ""}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Emoji
          <input className={input} value={f.thumbnail.emoji ?? ""} maxLength={4} onChange={(e) => setF({ ...f, thumbnail: { ...f.thumbnail, emoji: e.target.value } })} />
        </label>
        <label className="block text-sm font-semibold">Colour 1
          <input type="color" className="mt-1.5 h-11 w-full rounded-xl" value={f.thumbnail.from ?? "#2e2a3b"} onChange={(e) => setF({ ...f, thumbnail: { ...f.thumbnail, from: e.target.value } })} />
        </label>
        <label className="block text-sm font-semibold">Colour 2
          <input type="color" className="mt-1.5 h-11 w-full rounded-xl" value={f.thumbnail.to ?? "#e0177a"} onChange={(e) => setF({ ...f, thumbnail: { ...f.thumbnail, to: e.target.value } })} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Sessions, in order <span className="font-normal text-ink/50">· {f.workoutIds.length} workouts, {formatDuration(total)} in total</span></legend>
        <ol className="mt-2 space-y-2">
          {f.workoutIds.map((id, i) => {
            const w = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl bg-page px-3 py-2">
                <span className="font-display w-6 text-center">{i + 1}</span>
                <span className="flex-1">{w?.title ?? "Unknown workout"} <span className="text-xs text-ink/50">{w ? `${formatDuration(w.durationSec)} · ${w.state}` : ""}</span></span>
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded px-2 ring-1 ring-ink/10">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="rounded px-2 ring-1 ring-ink/10">↓</button>
                <button type="button" onClick={() => setF({ ...f, workoutIds: f.workoutIds.filter((x) => x !== id) })} className="rounded px-2 text-coral ring-1 ring-ink/10">Remove</button>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex gap-2">
          <select className="flex-1 rounded-xl border border-ink/15 px-3 py-2.5" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Workout to add">
            <option value="">Choose a workout to add…</option>
            {available.map((w) => <option key={w.id} value={w.id}>{w.title} ({w.state})</option>)}
          </select>
          <button type="button" disabled={!pick} onClick={() => { setF({ ...f, workoutIds: [...f.workoutIds, pick] }); setPick(""); }}
            className="rounded-full bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-40">Add</button>
        </div>
      </fieldset>

      {error && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button disabled={busy} className="rounded-full bg-coral px-6 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="rounded-full px-6 py-2.5 ring-1 ring-ink/15">Cancel</button>
      </div>
      <p className="text-xs text-ink/50">New programmes are saved as drafts. Publish from the list when it’s ready.</p>
    </form>
  );
}
