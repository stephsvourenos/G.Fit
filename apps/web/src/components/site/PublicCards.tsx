import Link from "next/link";
import { CATEGORY_LABEL, formatDuration } from "@app/domain";
import { equipmentText, INTENSITY_LABEL, type PublicInstructor, type PublicWorkout } from "@/lib/public-catalogue";
import { Art, CATEGORY_ART } from "./Art";
import { Tag } from "./ui";

export function WorkoutArt({ w, big = false }: { w: PublicWorkout; big?: boolean }) {
  return (
    <div className="grain absolute inset-0" style={{ background: `linear-gradient(135deg, ${w.thumbnail.from}, ${w.thumbnail.to})` }} aria-hidden>
      <span className={`absolute rotate-[-10deg] drop-shadow-xl ${big ? "bottom-[8%] right-[7%] text-[120px]" : "bottom-2 right-3 text-5xl"}`}>{w.thumbnail.emoji}</span>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}

export function PublicWorkoutCard({ w }: { w: PublicWorkout }) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-[18px] bg-ink-2 ring-1 ring-line transition hover:-translate-y-1 hover:ring-coral/60">
      <Link href={`/workouts/${w.slug}/`} className="block">
        <div className="relative aspect-[1.35] overflow-hidden">
          <WorkoutArt w={w} />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Tag>Included</Tag>
            <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold">{formatDuration(w.durationSec)}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-coral-2">{CATEGORY_LABEL[w.category] ?? w.category}</div>
          <h3 className="font-display mt-1 text-lg font-bold leading-snug tracking-[-0.02em]">{w.title}</h3>
          <div className="mt-1 text-sm text-muted">{w.instructorName ?? "G.Fit junior coach"} · {INTENSITY_LABEL[w.intensity]}</div>
          <div className="mt-3 border-t border-line pt-3 text-xs text-muted">{equipmentText(w)}</div>
        </div>
      </Link>
    </article>
  );
}

export function InstructorCard({ i }: { i: PublicInstructor }) {
  const first = i.specialties[0];
  return (
    <Link href={`/instructors/${i.slug}/`} className="group relative block min-h-[340px] overflow-hidden rounded-[18px] ring-1 ring-line"
      style={{ background: `radial-gradient(ellipse at 70% 20%, ${i.accent}aa, #211e2b 70%)` }}>
      {i.portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- consented coach portrait from our storage
        <img src={i.portraitUrl} alt={`${i.name}, G.Fit instructor`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 grid place-items-center pb-24"><Art id={first ? CATEGORY_ART[first] ?? "@star" : "@star"} size={120} /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="absolute inset-x-5 bottom-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-coral-2">{i.specialties.map((s) => CATEGORY_LABEL[s] ?? s).join(" & ")}</div>
        <h3 className="font-display mt-1 text-2xl font-bold tracking-[-0.02em]">{i.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-paper/80">{i.bio}</p>
        <span className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-bold ring-1 ring-white/40 group-hover:ring-white">
          {i.workoutCount} workout{i.workoutCount === 1 ? "" : "s"} →
        </span>
      </div>
    </Link>
  );
}
