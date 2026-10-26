"use client";

import { CATEGORY_LABEL, isAllowedForProfile } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { WatchShell } from "@/components/WatchShell";
import { WorkoutCard } from "@/components/WorkoutCard";
import { useHousehold } from "@/lib/household";

export function InstructorView({ id }: { id: string }) {
  return (
    <WatchShell>
      <Inner id={id} />
    </WatchShell>
  );
}

function Inner({ id }: { id: string }) {
  const h = useHousehold();
  const ins = instructors.find((i) => i.id === id);
  if (!ins) return <p className="p-10">Instructor not found.</p>;
  const list = workouts.filter((w) => w.instructorId === id && isAllowedForProfile(w, h.activeProfile!));
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-5">
        <div className="grid h-20 w-20 place-items-center rounded-3xl font-display text-3xl" style={{ background: ins.accent }}>{ins.displayName.split(" ").pop()![0]}</div>
        <div>
          <h1 className="font-display text-4xl">{ins.displayName}</h1>
          <p className="text-muted">{ins.specialties.map((s) => CATEGORY_LABEL[s]).join(" · ")}</p>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-paper/80">{ins.bio}</p>
      {/* No external links, social handles or contact options — instructors never communicate with members. */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((w) => <WorkoutCard key={w.id} w={w} />)}
      </div>
      {list.length === 0 && <p className="mt-8 text-muted">No workouts from {ins.displayName} for this profile yet.</p>}
    </div>
  );
}
