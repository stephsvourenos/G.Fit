"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABEL, filterWorkouts, isAllowedForProfile, type CategoryId, type Equipment, type Intensity } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { WatchShell } from "@/components/WatchShell";
import { WorkoutCard } from "@/components/WorkoutCard";
import { useHousehold } from "@/lib/household";

export default function SearchPage() {
  return (
    <WatchShell>
      <Search />
    </WatchShell>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-paper text-ink" : "bg-white/10 text-paper hover:bg-white/20"}`}>
      {children}
    </button>
  );
}

function Search() {
  const h = useHousehold();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | undefined>();
  const [intensity, setIntensity] = useState<Intensity | undefined>();
  const [maxMin, setMaxMin] = useState<number | undefined>();
  const [equipment, setEquipment] = useState<Equipment | undefined>();
  const [instructorId, setInstructorId] = useState<string | undefined>();
  const [captionsOnly, setCaptionsOnly] = useState(false);

  const allowed = workouts.filter((w) => isAllowedForProfile(w, h.activeProfile!));
  const results = filterWorkouts(allowed, { query, category, intensity, maxDurationSec: maxMin ? maxMin * 60 : undefined, equipment, instructorId, captionsOnly });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search workouts, e.g. “pilates”, “footwork”, “bedtime”"
        className="w-full rounded-2xl bg-ink-2 px-5 py-4 text-lg ring-1 ring-white/10 placeholder:text-muted focus:outline-none focus:ring-sun"
        aria-label="Search"
      />
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => <Chip key={c} on={category === c} onClick={() => setCategory(category === c ? undefined : c)}>{CATEGORY_LABEL[c]}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["gentle", "moderate", "energetic"] as Intensity[]).map((i) => <Chip key={i} on={intensity === i} onClick={() => setIntensity(intensity === i ? undefined : i)}>{i}</Chip>)}
          <span className="mx-1 w-px bg-white/10" />
          {[5, 10, 15, 20].map((m) => <Chip key={m} on={maxMin === m} onClick={() => setMaxMin(maxMin === m ? undefined : m)}>≤ {m} min</Chip>)}
          <span className="mx-1 w-px bg-white/10" />
          {(["none", "wall", "ball", "mat", "chair"] as Equipment[]).map((e) => <Chip key={e} on={equipment === e} onClick={() => setEquipment(equipment === e ? undefined : e)}>{e === "none" ? "no equipment" : e}</Chip>)}
          <span className="mx-1 w-px bg-white/10" />
          <Chip on={captionsOnly} onClick={() => setCaptionsOnly(!captionsOnly)}>captions</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          {instructors.map((i) => <Chip key={i.id} on={instructorId === i.id} onClick={() => setInstructorId(instructorId === i.id ? undefined : i.id)}>{i.displayName}</Chip>)}
        </div>
      </div>
      <p className="mt-6 text-sm text-muted">{results.length} workouts for {h.activeProfile!.nickname}</p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((w) => <WorkoutCard key={w.id} w={w} instructorName={instructors.find((i) => i.id === w.instructorId)?.displayName} />)}
      </div>
    </div>
  );
}
