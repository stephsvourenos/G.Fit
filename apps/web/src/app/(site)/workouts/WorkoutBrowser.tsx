"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL, type CategoryId } from "@app/domain";
import { PublicWorkoutCard } from "@/components/site/PublicCards";
import { audienceOf, needsNoEquipment, type PublicWorkout } from "@/lib/public-catalogue";

type Dur = "any" | "short" | "mid" | "long";
const DUR: Record<Dur, string> = { any: "Any length", short: "Under 15 min", mid: "15–20 min", long: "Over 20 min" };

const field = "min-h-11 rounded-xl bg-ink-3 px-3.5 text-sm text-paper ring-1 ring-line focus:outline-none focus:ring-coral";

/** Filters run in the browser over the full, server-rendered list, so every workout is in the page for search engines. */
export function WorkoutBrowser({ workouts, initialCategory = "all" }: { workouts: PublicWorkout[]; initialCategory?: CategoryId | "all" }) {
  const categories = useMemo(() => [...new Set(workouts.map((w) => w.category))], [workouts]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">(initialCategory);
  const [dur, setDur] = useState<Dur>("any");
  const [intensity, setIntensity] = useState("any");
  const [kit, setKit] = useState("any");
  const [who, setWho] = useState("any");

  const shown = workouts.filter((w) => {
    const m = w.durationSec / 60;
    const text = `${w.title} ${w.description} ${w.instructorName ?? ""} ${CATEGORY_LABEL[w.category] ?? ""}`.toLowerCase();
    return (!q || text.includes(q.trim().toLowerCase()))
      && (cat === "all" || w.category === cat)
      && (dur === "any" || (dur === "short" ? m < 15 : dur === "mid" ? m >= 15 && m <= 20 : m > 20))
      && (intensity === "any" || w.intensity === intensity)
      && (kit === "any" || (kit === "none" ? needsNoEquipment(w) : !needsNoEquipment(w)))
      && (who === "any" || audienceOf(w) === who || audienceOf(w) === "Everyone");
  });

  const clear = () => { setQ(""); setCat("all"); setDur("any"); setIntensity("any"); setKit("any"); setWho("any"); };

  return (
    <>
      <div className="mb-6 rounded-[18px] bg-ink-2/70 p-5 ring-1 ring-line">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workouts or instructors…" aria-label="Search workouts"
            className={`${field} placeholder:text-muted sm:col-span-2 lg:col-span-1`} />
          <select value={dur} onChange={(e) => setDur(e.target.value as Dur)} aria-label="Length" className={field}>
            {(Object.keys(DUR) as Dur[]).map((d) => <option key={d} value={d}>{DUR[d]}</option>)}
          </select>
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)} aria-label="Intensity" className={field}>
            <option value="any">Any intensity</option><option value="gentle">Gentle</option><option value="moderate">Moderate</option><option value="energetic">Energetic</option>
          </select>
          <select value={kit} onChange={(e) => setKit(e.target.value)} aria-label="Equipment" className={field}>
            <option value="any">Any equipment</option><option value="none">No equipment</option><option value="some">Uses equipment</option>
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who it’s for" className={field}>
            <option value="any">All ages</option><option value="Adults">Adults</option><option value="Teens">Teens</option><option value="Kids">Kids</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Workout type">
          {(["all", ...categories] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${cat === c ? "bg-coral/25 text-white ring-coral" : "bg-ink-3 text-paper/85 ring-line hover:ring-coral/60"}`}>
              {c === "all" ? "All" : CATEGORY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-5 text-sm text-muted" aria-live="polite">{shown.length} workout{shown.length === 1 ? "" : "s"}</p>
      {shown.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{shown.map((w) => <PublicWorkoutCard key={w.slug} w={w} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <h3 className="font-display text-xl font-bold">No workouts match those filters</h3>
          <p className="mt-2 text-muted">Try a different type, length or equipment option.</p>
          <button type="button" onClick={clear} className="mt-5 rounded-full bg-coral px-5 py-2.5 font-bold text-white">Clear filters</button>
        </div>
      )}
    </>
  );
}
