"use client";

import { AVATAR_GROUP_LABEL, AVATAR_GROUPS, AVATARS } from "@app/domain";
import { Avatar } from "./Avatar";

/** Netflix-style picker: one row per group, tap a picture to choose it. */
export function AvatarPicker({ value, onPick, colour }: { value: string; onPick: (id: string) => void; colour: string }) {
  return (
    <div className="space-y-5">
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
                className={`shrink-0 rounded-[28%] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wattle ${value === a.id ? "ring-[3px] ring-paper ring-offset-2 ring-offset-ink-2" : ""}`}
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
