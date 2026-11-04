"use client";

import MuxPlayer from "@mux/mux-player-react";
import type MuxPlayerElement from "@mux/mux-player";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PLAYBACK_POLICY, evaluateSession, type Heartbeat, type Workout } from "@app/domain";
import { useHousehold } from "@/lib/household";

const HEARTBEAT_MS = 12_000;

/**
 * Real, signed Mux playback. Sends the same 12-second heartbeats as the
 * simulator and runs the qualified-playback rules on them. (Phase 2 next step:
 * the server stores and validates these heartbeats for royalties.)
 */
export function VideoPlayer({ w, playbackId, tokens, instructorName }: {
  w: Workout;
  playbackId: string;
  tokens: { playback: string; thumbnail: string; storyboard: string };
  instructorName: string;
}) {
  const h = useHousehold();
  const ref = useRef<MuxPlayerElement | null>(null);
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [ended, setEnded] = useState(false);
  const seq = useRef(0);
  const [startedAt] = useState(() => Date.now());
  const [duration, setDuration] = useState(w.durationSec);

  const beat = () => {
    const el = ref.current;
    if (!el) return;
    setBeats((b) => [
      ...b,
      {
        sessionId: "live",
        seq: seq.current++,
        receivedAt: Date.now(),
        positionSec: el.currentTime ?? 0,
        playing: !el.paused && !el.ended,
        visible: document.visibilityState === "visible",
        buffering: (el.readyState ?? 4) < 3,
        playbackRate: el.playbackRate ?? 1,
      },
    ]);
  };

  useEffect(() => {
    const t = window.setInterval(beat, HEARTBEAT_MS);
    const onVis = () => beat();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const evaluation = useMemo(
    () =>
      evaluateSession(
        {
          sessionId: "live",
          householdId: h.activeProfile?.householdId ?? "",
          profileId: h.activeProfile?.id ?? "",
          workoutId: w.id,
          creatorId: w.creatorId,
          deviceId: "this-browser",
          durationSec: duration,
          tokenIssued: true,
          accessibilityMode: false,
          startedAt,
        },
        beats,
        DEFAULT_PLAYBACK_POLICY,
      ),
    [beats, duration, h.activeProfile, w, startedAt],
  );

  useEffect(() => {
    if (ended && evaluation.qualifies) h.markCompleted(w.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  return (
    <div className="flex flex-1 flex-col bg-black lg:flex-row">
      <div className="flex min-h-[60vh] flex-1 flex-col">
        <div className="flex items-center justify-between p-4">
          <Link href={`/watch/workout/${w.id}/`} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">← Back</Link>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sun">{instructorName}</div>
            <div className="font-display text-xl">{w.title}</div>
          </div>
          <button onClick={() => setShowPanel(!showPanel)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">{showPanel ? "Hide" : "Show"} tracking</button>
        </div>
        <div className="flex flex-1 items-center justify-center px-2 pb-4">
          <MuxPlayer
            ref={ref}
            playbackId={playbackId}
            tokens={tokens}
            streamType="on-demand"
            accentColor="#FF5A36"
            title={w.title}
            metadata={{ video_title: w.title, video_id: w.id }}
            disableTracking
            startTime={Math.min(h.progress[w.id] ?? 0, Math.max(0, duration - 5))}
            onLoadedMetadata={() => ref.current?.duration && setDuration(Math.round(ref.current.duration))}
            onPlay={beat}
            onPause={() => {
              beat();
              if (ref.current) h.setProgress(w.id, Math.floor(ref.current.currentTime));
            }}
            onSeeking={beat}
            onEnded={() => {
              beat();
              setEnded(true);
              h.setProgress(w.id, 0);
            }}
            style={{ width: "100%", maxWidth: 1100, aspectRatio: "16 / 9" }}
          />
        </div>
        {ended && (
          <p className="pb-6 text-center text-paper/85">
            {evaluation.qualifies ? "🏅 Workout complete — added to your progress." : "👏 Nice moving! Watch more of the session to count it as complete."}
          </p>
        )}
      </div>
      {showPanel && (
        <aside className="w-full border-t border-white/10 bg-ink-2 p-5 text-sm lg:w-80 lg:border-l lg:border-t-0">
          <h3 className="font-display text-xl">Qualified playback</h3>
          <p className="mt-1 text-xs text-muted">The rules that will decide creator royalties. Hidden from members at launch.</p>
          <dl className="mt-4 grid grid-cols-2 gap-y-2">
            <dt className="text-muted">Coverage</dt><dd className="text-right font-semibold">{Math.round(evaluation.coverage * 100)}%</dd>
            <dt className="text-muted">Needed</dt><dd className="text-right font-semibold">{Math.round(evaluation.requiredFraction * 100)}%</dd>
            <dt className="text-muted">Heartbeats</dt><dd className="text-right font-semibold">{beats.length}</dd>
            <dt className="text-muted">Credited</dt><dd className="text-right font-semibold">{evaluation.qualifies ? `${Math.round(evaluation.creditedSec)}s` : "Not yet"}</dd>
          </dl>
          {evaluation.flags.length > 0 && <p className="mt-3 text-coral-2">{evaluation.flags.join(", ").replaceAll("-", " ")}</p>}
        </aside>
      )}
    </div>
  );
}
