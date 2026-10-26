"use client";

import Link from "next/link";
import { buildHomeRows, CATEGORY_LABEL, formatDuration, isAllowedForProfile } from "@app/domain";
import { instructors, programs, workouts } from "@app/mock-data";
import { Thumb } from "@/components/Thumb";
import { WatchShell } from "@/components/WatchShell";
import { WorkoutCard } from "@/components/WorkoutCard";
import { useHousehold } from "@/lib/household";

export default function HomePage() {
  return (
    <WatchShell>
      <Home />
    </WatchShell>
  );
}

function Home() {
  const h = useHousehold();
  const profile = h.activeProfile!;
  const rows = buildHomeRows({
    profile,
    workouts,
    instructors,
    progress: h.progress,
    favourites: h.favourites,
    completed: h.completed.map((c) => c.workoutId),
  });
  const hero = rows.find((r) => r.id === "recommended")?.workouts[0] ?? rows[0]?.workouts[0];
  const heroInstructor = instructors.find((i) => i.id === hero?.instructorId);
  const visiblePrograms = programs
    .map((p) => ({ ...p, items: workouts.filter((w) => p.workoutIds.includes(w.id) && isAllowedForProfile(w, profile)) }))
    .filter((p) => p.items.length >= 2);

  return (
    <div className="pb-16">
      {hero && (
        <section className="relative isolate overflow-hidden">
          <Thumb w={hero} size="lg" className="absolute inset-0 -z-10 opacity-70" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink to-transparent" />
          <div className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
            <p className="text-sm font-semibold text-sun">Hi {profile.nickname} 👋 Picked for you</p>
            <h1 className="font-display mt-2 max-w-2xl text-4xl leading-[1.02] sm:text-6xl">{hero.title}</h1>
            <p className="mt-3 max-w-xl text-paper/80">{hero.description}</p>
            <p className="mt-3 text-sm text-muted">
              {CATEGORY_LABEL[hero.category]} · {formatDuration(hero.durationSec)} · {heroInstructor?.displayName} · {hero.intensity}
            </p>
            <div className="mt-6 flex gap-3">
              <Link href={`/watch/play/${hero.id}/`} className="rounded-full bg-paper px-6 py-3 font-semibold text-ink hover:bg-white">▶ Play</Link>
              <Link href={`/watch/workout/${hero.id}/`} className="rounded-full bg-white/15 px-6 py-3 font-semibold backdrop-blur hover:bg-white/25">Details</Link>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6">
        {rows.map((row, idx) => (
          <section key={row.id}>
            <h2 className="font-display mb-3 text-2xl">{row.title}</h2>
            <div className="row-scroll">
              {row.workouts.map((w) => (
                <WorkoutCard key={w.id} w={w} progressSec={row.progress?.[w.id]} instructorName={instructors.find((i) => i.id === w.instructorId)?.displayName} />
              ))}
            </div>
            {idx === 1 && visiblePrograms.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display mb-3 text-2xl">Programs</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {visiblePrograms.map((p) => (
                    <div key={p.id} className="rounded-2xl bg-gradient-to-br from-ink-3 to-ink-2 p-5 ring-1 ring-white/5">
                      <div className="text-3xl">{p.emoji}</div>
                      <div className="font-display mt-2 text-xl">{p.title}</div>
                      <p className="text-sm text-muted">{p.blurb}</p>
                      <ol className="mt-3 space-y-1 text-sm">
                        {p.items.map((w, i) => (
                          <li key={w.id}>
                            <Link href={`/watch/workout/${w.id}/`} className="text-paper/85 hover:text-sun">{i + 1}. {w.title}</Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
