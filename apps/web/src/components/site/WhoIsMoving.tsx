"use client";

import { useState } from "react";
import { AGE_BAND_LABEL, CATEGORY_LABEL, formatDuration, type AgeBand } from "@app/domain";
import { workouts } from "@app/mock-data";
import { Avatar } from "@/components/Avatar";
import { Art, CATEGORY_ART } from "./Art";

const FAMILY: Array<{ name: string; band: AgeBand; pic: string; line: string }> = [
  { name: "Sam", band: "adult", pic: "@run2", line: "Wall Pilates on a lunch break, strength after bedtime." },
  { name: "Jordan", band: "13-15", pic: "@foot2", line: "Footwork drills and strength basics for sport." },
  { name: "Mia", band: "6-8", pic: "@danc1", line: "Dance breaks and obstacle courses before school." },
  { name: "Leo", band: "under-6", pic: "@roo", line: "Five-minute animal moves and balance games." },
];

const published = workouts.filter((w) => w.state === "published");

/** The hero's live demo: tap a family member and see the shelf their profile gets. */
export function WhoIsMoving() {
  const [who, setWho] = useState(2);
  const me = FAMILY[who]!;
  const shelf = published.filter((w) => w.ageBands.includes(me.band)).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
      <div>
        <div role="radiogroup" aria-label="Choose a family member" className="flex flex-wrap gap-3 sm:gap-5">
          {FAMILY.map((p, i) => (
            <button
              key={p.name}
              role="radio"
              aria-checked={i === who}
              onClick={() => setWho(i)}
              className="group flex flex-col items-center gap-2"
            >
              <span className={`rounded-[30%] p-1 transition sm:scale-125 sm:mx-2 sm:my-2 ${i === who ? "bg-paper" : "bg-transparent group-hover:bg-white/15"}`}>
                <Avatar p={{ nickname: p.name, avatar: { emoji: p.pic, colour: "#E0177A" } }} size={64} />
              </span>
              <span className={`text-sm font-bold ${i === who ? "text-paper" : "text-muted group-hover:text-paper"}`}>{p.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 max-w-sm text-paper/80" aria-live="polite">
          <span className="font-bold text-paper">{me.name}’s profile</span> ({me.band === "adult" ? "adult" : `age ${AGE_BAND_LABEL[me.band].toLowerCase()}`}): {me.line}
        </p>
      </div>

      <div className="rounded-[28px] bg-ink-2 p-4 ring-1 ring-white/10 sm:p-5">
        <div className="flex items-center justify-between px-1 pb-3">
          <span className="font-display text-lg text-paper">Picked for {me.name}</span>
          <span className="text-xs text-muted">{shelf.length} of {published.filter((w) => w.ageBands.includes(me.band)).length} workouts</span>
        </div>
        <ul className="grid gap-2.5">
          {shelf.map((w) => (
            <li key={w.id} className="flex items-center gap-4 rounded-2xl bg-ink-3/70 p-2.5 pr-4">
              <Art id={CATEGORY_ART[w.category]} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-paper">{w.title}</div>
                <div className="text-sm text-muted">{CATEGORY_LABEL[w.category]}, {formatDuration(w.durationSec)}</div>
              </div>
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
