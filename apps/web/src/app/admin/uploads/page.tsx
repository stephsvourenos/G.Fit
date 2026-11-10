import Link from "next/link";
import { PageHeader } from "@/components/AdminShell";

const STEPS: Array<[string, string]> = [
  ["Add the creator", "Creators & contracts → New creator (adds their coach profile), then New contract version for their terms."],
  ["Create the workout", "Content approval → New workout: title, coach, category, length, intensity, age groups, equipment."],
  ["Upload the video", "Open the workout → Upload video file. It goes straight from your browser to Mux (never through our servers). English captions are made automatically."],
  ["Check it", "Wait for “ready” on video and captions, watch it once (including the captions), then tick the rights & safety checklist."],
  ["Review and publish", "Move it to review → approved → Publish. The system refuses to publish without video, captions and every rights check."],
];

export default function UploadsPage() {
  return (
    <>
      <PageHeader title="Adding workouts" sub="How a new video gets from your laptop to families — five steps, all in the admin." />
      <ol className="grid gap-3">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-4 rounded-xl bg-white p-4 ring-1 ring-ink/5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-semibold text-paper">{i + 1}</span>
            <div><div className="font-semibold">{title}</div><p className="mt-0.5 text-sm text-ink/65">{text}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/content/" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">Go to Content approval</Link>
        <Link href="/admin/creators/" className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-ink/20">Creators & contracts</Link>
      </div>
      <p className="mt-6 max-w-3xl text-xs text-ink/50">
        Video files: MP4 or MOV, landscape 1080p recommended. Only upload videos you have the rights to, with cleared music and written
        consent from everyone who appears (a parent or guardian for anyone under 18). The free Mux plan holds 10 videos; a paid plan is
        needed before uploading the full launch library.
      </p>
    </>
  );
}
