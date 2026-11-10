"use client";

import { useSyncExternalStore } from "react";
import { avatarById, stillSvg, type Profile } from "@app/domain";

const RM = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(RM);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** True when the person has asked their device for less motion (or before we know). */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => !!window.matchMedia?.(RM).matches, () => true);
}

/**
 * A profile picture: either one from the illustrated library ("@id") or an emoji on a colour tile (older profiles).
 * The library SVGs are our own constants (never user input), so rendering them as markup is safe.
 */
export function Avatar({ p, size = 96, still }: { p: Pick<Profile, "avatar" | "nickname">; size?: number; still?: boolean }) {
  const reduced = useReducedMotion();
  const pic = avatarById(p.avatar.emoji);
  if (pic) {
    return (
      <div
        className="overflow-hidden rounded-[28%] shadow-lg ring-1 ring-white/10 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ width: size, height: size }}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: still || reduced ? stillSvg(pic.svg) : pic.svg }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-[28%] shadow-lg ring-1 ring-white/10"
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, ${p.avatar.colour}ee, ${p.avatar.colour}88)` }}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.5 }}>{p.avatar.emoji}</span>
    </div>
  );
}
