"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/AdminShell";
import type { VideoInfo, VideoStatus } from "@/lib/catalog-db";
import { putFile, videoAdmin } from "@/lib/video";

const LABEL: Record<VideoStatus, [string, "grey" | "amber" | "blue" | "green" | "red"]> = {
  none: ["no video", "grey"],
  waiting: ["waiting for upload", "amber"],
  processing: ["processing", "blue"],
  ready: ["ready", "green"],
  errored: ["failed", "red"],
};

export function VideoBadge({ v }: { v?: VideoInfo }) {
  const [label, tone] = LABEL[v?.status ?? "none"];
  return <Badge tone={tone}>{label}</Badge>;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Upload or replace a workout's video. The file goes straight from this
 * browser to Mux (never through our servers). Mux tells us by webhook when
 * it's ready; "Check status" asks Mux directly as a fallback.
 */
export function VideoPanel({ workoutId, title, v, onChange }: { workoutId: string; title: string; v?: VideoInfo; onChange: (v: VideoInfo) => void }) {
  const [busy, setBusy] = useState<string>();
  const [pct, setPct] = useState<number>();
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const status = v?.status ?? "none";

  async function refresh() {
    const r = await videoAdmin("refresh", workoutId);
    onChange({ status: (r.video_status as VideoStatus) ?? status, error: (r.video_error as string) ?? null, durationSec: (r.video_duration_sec as number) ?? v?.durationSec ?? null });
  }

  // While Mux is working, check every 8 seconds.
  useEffect(() => {
    if (status !== "processing" && status !== "waiting") return;
    if (busy) return;
    const t = window.setInterval(() => void refresh().catch(() => undefined), 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, busy]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
      setPct(undefined);
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Video</div>
        <VideoBadge v={v} />
      </div>
      {status === "ready" && v?.durationSec ? <p className="mt-1 text-xs text-ink/60">Length {mmss(v.durationSec)} · plays only through signed, expiring links</p> : null}
      {status === "errored" && <p className="mt-1 text-xs text-[#b8361a]">{v?.error ?? "Mux couldn’t process this file."} Try uploading it again.</p>}
      {status === "processing" && <p className="mt-1 text-xs text-ink/60">Mux is preparing the video for every screen size. This usually takes under a minute per minute of video.</p>}
      {pct !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" aria-label="Upload progress">
          <div className="h-full bg-coral transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <input
        ref={fileRef}
        id={`video-file-${workoutId}`}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void run("upload", async () => {
            const { uploadUrl } = await videoAdmin("create-upload", workoutId);
            onChange({ status: "waiting", error: null, durationSec: null });
            setPct(0);
            await putFile(uploadUrl!, file, setPct);
            await refresh();
          });
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!!busy} onClick={() => fileRef.current?.click()} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-50">
          {busy === "upload" ? `Uploading ${pct ?? 0}%…` : status === "none" ? "Upload video file" : "Replace video"}
        </button>
        <button
          disabled={!!busy}
          onClick={() => void run("sample", async () => {
            const r = await videoAdmin("use-sample", workoutId);
            onChange({ status: (r.video_status as VideoStatus) ?? "processing", error: null, durationSec: null });
          })}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/20 disabled:opacity-50"
          title={`Attach Mux's short demo clip to “${title}” for testing`}
        >
          {busy === "sample" ? "Attaching…" : "Use sample test clip"}
        </button>
        {status !== "none" && (
          <button disabled={!!busy} onClick={() => void run("refresh", refresh)} className="rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/20 disabled:opacity-50">
            {busy === "refresh" ? "Checking…" : "Check status"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[#b8361a]">{error}</p>}
      <p className="mt-3 text-[11px] text-ink/50">
        Only upload videos you have the rights to, with cleared music. Free Mux plan: up to 10 videos — replacing a video removes the old one.
      </p>
    </div>
  );
}
