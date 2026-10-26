"use client";

import Link from "next/link";
import { AGE_BAND_LABEL, CATEGORY_LABEL, decidePlayback, formatDuration } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { Thumb } from "@/components/Thumb";
import { WatchShell } from "@/components/WatchShell";
import { WorkoutCard } from "@/components/WorkoutCard";
import { useHousehold } from "@/lib/household";

export function WorkoutDetail({ id }: { id: string }) {
  return (
    <WatchShell>
      <Detail id={id} />
    </WatchShell>
  );
}

const DENIAL_TEXT = {
  "no-entitlement": "Membership inactive — a parent can renew in Family account.",
  "age-restricted": "This one isn’t available on this profile.",
  "pin-required": "A parent PIN is needed for this profile.",
  "not-published": "This workout isn’t available yet.",
} as const;

function Detail({ id }: { id: string }) {
  const h = useHousehold();
  const w = workouts.find((x) => x.id === id);
  if (!w) return <p className="p-10">Workout not found.</p>;
  const ins = instructors.find((i) => i.id === w.instructorId)!;
  const decision = decidePlayback({ entitlement: h.entitlement, profile: h.activeProfile!, workout: w, pinUnlocked: h.pinUnlocked, now: new Date() });
  const fav = h.favourites.includes(w.id);
  const more = workouts.filter((x) => x.instructorId === w.instructorId && x.id !== w.id && x.state === "published").slice(0, 6);

  return (
    <div className="pb-16">
      <div className="relative">
        <Thumb w={w} size="lg" className="h-64 w-full sm:h-96" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
      </div>
      <div className="mx-auto -mt-24 max-w-5xl px-4 sm:px-6 relative">
        <p className="text-sm font-semibold text-sun">{CATEGORY_LABEL[w.category]}</p>
        <h1 className="font-display mt-1 text-4xl sm:text-5xl">{w.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          {[formatDuration(w.durationSec), w.intensity, ...w.equipment.map((e) => (e === "none" ? "no equipment" : e)), w.captions ? "captions" : "no captions"].map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-3 py-1">{t}</span>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-paper/80">{w.description}</p>
        {w.accessibilityNotes && <p className="mt-2 text-sm text-mint">♿ {w.accessibilityNotes}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {decision.allowed ? (
            <Link href={`/watch/play/${w.id}/`} className="rounded-full bg-coral px-7 py-3 font-semibold text-white hover:bg-coral-2">▶ Start workout</Link>
          ) : (
            <span className="rounded-full bg-white/10 px-5 py-3 text-sm">🔒 {DENIAL_TEXT[decision.reason!]}</span>
          )}
          <button onClick={() => h.toggleFavourite(w.id)} className="rounded-full px-5 py-3 font-semibold ring-1 ring-white/20 hover:ring-white/50">
            {fav ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
        <p className="mt-4 text-xs text-muted">
          Suitable for: {w.ageBands.map((b) => AGE_BAND_LABEL[b]).join(", ")}. Stop if anything hurts, and make sure
          there’s clear space around you. Younger children should move with an adult nearby.
        </p>

        <Link href={`/watch/instructor/${ins.id}/`} className="mt-8 flex items-center gap-4 rounded-2xl bg-ink-2 p-4 ring-1 ring-white/5 hover:ring-white/20">
          <div className="grid h-12 w-12 place-items-center rounded-2xl font-display text-xl" style={{ background: ins.accent }}>{ins.displayName.split(" ").pop()![0]}</div>
          <div>
            <div className="font-display text-lg">{ins.displayName}</div>
            <div className="text-sm text-muted">{ins.bio}</div>
          </div>
        </Link>

        {more.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display mb-3 text-2xl">More with {ins.displayName}</h2>
            <div className="row-scroll">{more.map((m) => <WorkoutCard key={m.id} w={m} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
