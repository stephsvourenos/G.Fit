"use client";

import { currentStreak } from "@app/domain";
import { workouts } from "@app/mock-data";
import { WatchShell } from "@/components/WatchShell";
import { WorkoutCard } from "@/components/WorkoutCard";
import { useHousehold } from "@/lib/household";

export default function MePage() {
  return (
    <WatchShell>
      <Me />
    </WatchShell>
  );
}

function Me() {
  const h = useHousehold();
  const done = h.completed;
  const streak = currentStreak(done.map((d) => d.day), new Date().toISOString().slice(0, 10));
  const distinct = new Set(done.map((d) => d.workoutId)).size;
  const badges = [
    { icon: "🌱", name: "First move", earned: done.length >= 1, how: "Finish any workout" },
    { icon: "🔥", name: "3-day streak", earned: streak >= 3, how: "Move three days in a row" },
    { icon: "🧭", name: "Explorer", earned: distinct >= 5, how: "Try five different workouts" },
    { icon: "🤝", name: "Family time", earned: false, how: "Do a partner workout together" },
  ];
  const saved = workouts.filter((w) => h.favourites.includes(w.id));
  const history = [...done].reverse().map((d) => ({ ...d, w: workouts.find((w) => w.id === d.workoutId)! })).filter((x) => x.w);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">{h.activeProfile!.nickname}’s progress</h1>
      <p className="mt-1 text-muted">Showing up is what counts. No scores, no rankings.</p>
      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        {[["Streak", `${streak} day${streak === 1 ? "" : "s"}`], ["Completed", String(done.length)], ["Different workouts", String(distinct)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-ink-2 p-4 ring-1 ring-white/5">
            <div className="font-display text-3xl text-sun">{v}</div>
            <div className="text-xs text-muted">{k}</div>
          </div>
        ))}
      </div>
      <h2 className="font-display mt-10 text-2xl">Badges</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {badges.map((b) => (
          <div key={b.name} className={`rounded-2xl p-4 ring-1 ${b.earned ? "bg-ink-3 ring-sun/40" : "bg-ink-2 ring-white/5 opacity-60"}`}>
            <div className={`text-4xl ${b.earned ? "" : "grayscale"}`}>{b.icon}</div>
            <div className="mt-2 font-semibold">{b.name}</div>
            <div className="text-xs text-muted">{b.earned ? "Earned!" : b.how}</div>
          </div>
        ))}
      </div>
      <h2 className="font-display mt-10 text-2xl">Saved</h2>
      {saved.length ? (
        <div className="row-scroll mt-3">{saved.map((w) => <WorkoutCard key={w.id} w={w} />)}</div>
      ) : (
        <p className="mt-2 text-muted">Tap ♡ Save on any workout to keep it here.</p>
      )}
      <h2 className="font-display mt-10 text-2xl">History</h2>
      {history.length ? (
        <ul className="mt-3 divide-y divide-white/5 rounded-2xl bg-ink-2">
          {history.map((x, i) => <li key={i} className="flex justify-between px-4 py-3 text-sm"><span>{x.w.title}</span><span className="text-muted">{x.day}</span></li>)}
        </ul>
      ) : (
        <p className="mt-2 text-muted">Finish a workout and it will appear here.</p>
      )}
    </div>
  );
}
