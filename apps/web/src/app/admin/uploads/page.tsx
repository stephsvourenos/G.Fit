import { PageHeader } from "@/components/AdminShell";

export default function UploadsPage() {
  return (
    <>
      <PageHeader title="Media uploads" sub="Arrives in Phase 2 with Mux." />
      <div className="grid place-items-center rounded-2xl border-2 border-dashed border-ink/20 bg-white p-16 text-center">
        <div className="text-5xl">🎬</div>
        <p className="mt-4 max-w-md text-ink/70">
          You’ll drag a video file here. It uploads straight from your browser to Mux using a one-time signed upload
          link (the file never passes through our server). Mux processes it and tells us by webhook when it’s ready
          for review.
        </p>
        <button disabled className="mt-6 rounded-full bg-ink/20 px-5 py-2.5 font-semibold text-white">Upload video (Phase 2)</button>
      </div>
    </>
  );
}
