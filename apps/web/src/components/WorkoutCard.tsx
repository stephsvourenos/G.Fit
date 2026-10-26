import Link from "next/link";
import { CATEGORY_LABEL, formatDuration, type Workout } from "@app/domain";
import { Thumb } from "./Thumb";

export function WorkoutCard({ w, progressSec, instructorName }: { w: Workout; progressSec?: number; instructorName?: string }) {
  const pct = progressSec ? Math.min(100, Math.round((progressSec / w.durationSec) * 100)) : 0;
  return (
    <Link href={`/watch/workout/${w.id}/`} className="group block rounded-2xl overflow-hidden bg-ink-2 ring-1 ring-white/5 hover:ring-white/25 transition">
      <div className="relative aspect-video">
        <Thumb w={w} className="absolute inset-0 group-hover:scale-[1.03] transition-transform duration-500" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {formatDuration(w.durationSec)}
        </span>
        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">{CATEGORY_LABEL[w.category]}</div>
        <div className="mt-0.5 font-display text-[17px] leading-tight text-paper">{w.title}</div>
        {instructorName && <div className="mt-1 text-xs text-muted">{instructorName}</div>}
      </div>
    </Link>
  );
}
