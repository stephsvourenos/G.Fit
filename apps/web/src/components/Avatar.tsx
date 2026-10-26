import type { Profile } from "@app/domain";

export function Avatar({ p, size = 96 }: { p: Pick<Profile, "avatar" | "nickname">; size?: number }) {
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
