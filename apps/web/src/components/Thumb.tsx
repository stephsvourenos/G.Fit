import type { Workout } from "@app/domain";

/** Stand-in artwork until real thumbnails exist: brand gradient + category glyph. */
export function Thumb({ w, size = "md", className = "" }: { w: Workout; size?: "sm" | "md" | "lg"; className?: string }) {
  const emoji = size === "lg" ? "text-[110px]" : size === "md" ? "text-5xl" : "text-3xl";
  return (
    <div
      className={`grain overflow-hidden ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`}
      style={{ background: `linear-gradient(135deg, ${w.thumbnail.from}, ${w.thumbnail.to})` }}
      aria-hidden
    >
      <div className={`absolute rotate-[-10deg] opacity-95 drop-shadow-xl select-none ${size === "lg" ? "right-[6%] bottom-[8%]" : "right-3 bottom-1"}`}>
        <span className={emoji}>{w.thumbnail.emoji}</span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}
