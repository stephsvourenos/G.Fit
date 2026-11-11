"use client";

import { AVATAR_GROUP_LABEL, AVATAR_GROUPS, AVATARS, type CoachPicture } from "@app/domain";
import { Avatar } from "./Avatar";

const ring = (on: boolean) =>
  `shrink-0 rounded-[28%] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wattle ${on ? "ring-[3px] ring-paper ring-offset-2 ring-offset-ink-2" : ""}`;

/**
 * Netflix-style picker: one row per group, tap a picture to choose it.
 * Coach portraits (only coaches who gave written consent) come first and use the value "coach:<id>".
 */
export function AvatarPicker({ value, onPick, colour, coaches = [] }: { value: string; onPick: (id: string) => void; colour: string; coaches?: CoachPicture[] }) {
  return (
    <div className="space-y-5">
      {coaches.length > 0 && (
        <section aria-label="Coaches">
          <h3 className="mb-2 text-sm font-semibold text-paper/80">Coaches</h3>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin]">
            {coaches.map((c) => (
              <button type="button" key={c.id} onClick={() => onPick(`coach:${c.id}`)} aria-label={c.name} aria-pressed={value === `coach:${c.id}`} title={c.name} className={`flex flex-col items-center gap-1 ${ring(value === `coach:${c.id}`)}`}>
                <Avatar p={{ nickname: c.name, avatar: { emoji: "", colour, coach: c } }} size={68} />
              </button>
            ))}
          </div>
        </section>
      )}
      {AVATAR_GROUPS.map((g) => (
        <section key={g} aria-label={AVATAR_GROUP_LABEL[g]}>
          <h3 className="mb-2 text-sm font-semibold text-paper/80">{AVATAR_GROUP_LABEL[g]}</h3>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin]">
            {AVATARS.filter((a) => a.group === g).map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => onPick(a.id)}
                aria-label={a.name}
                aria-pressed={value === a.id}
                title={a.name}
                className={ring(value === a.id)}
              >
                <Avatar p={{ nickname: a.name, avatar: { emoji: a.id, colour } }} size={68} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
