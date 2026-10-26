"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  decidePlayback,
  DEFAULT_PLAYBACK_POLICY,
  evaluateSession,
  type CategoryId,
  type Heartbeat,
  type PlaybackSession,
} from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { Thumb } from "@/components/Thumb";
import { useHousehold } from "@/lib/household";

const CUES: Record<CategoryId, string[]> = {
  soccer: ["Toe taps", "Sole rolls", "Inside-outside", "Quick feet", "Pull-backs", "Rest & breathe"],
  pilates: ["Wall sit breathing", "Bridge lifts", "Leg slides", "Dead bug", "Side-lying lifts", "Child’s pose"],
  "move-and-play": ["Frog hops", "Bear crawl", "Flamingo balance", "Crab walk", "Star jumps", "Wiggle it out"],
  dance: ["Step-touch", "Grapevine", "Arm waves", "Bounce & clap", "Spin & freeze", "Free dance"],
  strength: ["Chair squats", "Wall push-ups", "Lunges", "Plank hold", "Glute bridges", "Stretch"],
  mobility: ["Neck circles", "Cat–cow", "Hip openers", "Thread the needle", "Hamstring reach", "Breathe"],
  challenges: ["Warm-up", "Attempt one", "Reset", "Attempt two", "Personal best", "Cool-down"],
};

const HEARTBEAT_EVERY = 12; // seconds of (simulated) real time

/**
 * PROTOTYPE PLAYER. Real playback (Phase 2) uses Mux with a short-lived signed
 * token minted only after the server-side entitlement check. This simulator
 * sends the same heartbeats the real player will, and runs the real
 * qualified-playback rules so you can see exactly what would be credited.
 */
export function Player({ id }: { id: string }) {
  const h = useHousehold();
  const w = workouts.find((x) => x.id === id);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20); // demo time-lapse
  const [buffering, setBuffering] = useState(false);
  const [visible, setVisible] = useState(true);
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const [showPanel, setShowPanel] = useState(true);
  const [finished, setFinished] = useState(false);
  const clock = useRef(0); // simulated server clock (ms)
  const lastBeat = useRef(0);
  const seq = useRef(0);
  // Latest player state for the timer loop. The loop and handlers update it
  // directly; this effect re-syncs it after every render.
  const state = useRef({ pos: 0, playing: false, buffering: false, visible: true });
  useEffect(() => {
    state.current = { pos, playing, buffering, visible };
  });

  const session: PlaybackSession | undefined = useMemo(
    () =>
      w && h.activeProfile
        ? {
            sessionId: "demo-session",
            householdId: h.activeProfile.householdId,
            profileId: h.activeProfile.id,
            workoutId: w.id,
            creatorId: w.creatorId,
            deviceId: "this-browser",
            durationSec: w.durationSec,
            tokenIssued: true,
            accessibilityMode: false,
            startedAt: 0,
          }
        : undefined,
    [w, h.activeProfile],
  );

  function beat(overrides: Partial<Heartbeat> = {}) {
    // Capture values NOW (not inside the state updater, which runs later).
    const s = state.current;
    const at = clock.current <= lastBeat.current ? lastBeat.current + 1 : clock.current;
    const hb: Heartbeat = {
      sessionId: "demo-session",
      seq: seq.current++,
      receivedAt: at,
      positionSec: s.pos,
      playing: s.playing,
      visible: s.visible,
      buffering: s.buffering,
      playbackRate: 1,
      ...overrides,
    };
    setBeats((b) => [...b, hb]);
    lastBeat.current = at;
  }

  // Resume where this profile left off (once saved progress has loaded).
  const resumed = useRef(false);
  useEffect(() => {
    if (!w || !h.ready || resumed.current) return;
    resumed.current = true;
    const saved = h.progress[w.id] ?? 0;
    if (saved > 0 && saved < w.durationSec * 0.95) {
      state.current.pos = saved;
      setPos(saved); // eslint-disable-line react-hooks/set-state-in-effect -- one-off resume after storage loads
    }
  }, [h.ready, h.progress, w]);

  // Tab visibility is a real signal the production player reports too.
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!w) return;
    const tickMs = 100;
    const t = window.setInterval(() => {
      const dt = (tickMs / 1000) * speed; // simulated seconds per tick
      clock.current += dt * 1000;
      const s = state.current;
      if (s.playing && !s.buffering) {
        const next = Math.min(w.durationSec, s.pos + dt);
        state.current.pos = next;
        setPos(next);
        if (next >= w.durationSec) {
          setPlaying(false);
          state.current.playing = true; // final heartbeat records the last stretch as played
          beat({ positionSec: w.durationSec, playing: true });
          setFinished(true);
          return;
        }
      }
      if (clock.current - lastBeat.current >= HEARTBEAT_EVERY * 1000) beat();
    }, tickMs);
    return () => window.clearInterval(t);
  }, [w, speed]);

  const evaluation = session ? evaluateSession(session, beats, DEFAULT_PLAYBACK_POLICY) : undefined;

  useEffect(() => {
    if (!w) return;
    h.setProgress(w.id, Math.floor(pos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(pos / 15)]);

  useEffect(() => {
    if (finished && evaluation?.qualifies && w) h.markCompleted(w.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!h.ready) return null;
  if (!w || !h.activeProfile) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <p>Choose a profile first.</p>
          <Link href="/watch/" className="mt-4 inline-block underline">Profiles</Link>
        </div>
      </div>
    );
  }

  const decision = decidePlayback({ entitlement: h.entitlement, profile: h.activeProfile, workout: w, pinUnlocked: h.pinUnlocked, now: new Date() });
  if (!decision.allowed) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <div className="text-5xl">🔒</div>
          <p className="mt-4 text-lg">Playback blocked by the server-side check: <b>{decision.reason}</b></p>
          <Link href="/watch/home/" className="mt-4 inline-block underline">Back home</Link>
        </div>
      </div>
    );
  }

  const ins = instructors.find((i) => i.id === w.instructorId)!;
  const cues = CUES[w.category];
  const cue = cues[Math.min(cues.length - 1, Math.floor((pos / w.durationSec) * cues.length))];
  const remaining = Math.max(0, Math.ceil(w.durationSec - pos));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function seekTo(p: number) {
    beat(); // record where we were before the jump
    const clamped = Math.max(0, Math.min(w!.durationSec - 0.5, p));
    state.current.pos = clamped;
    setPos(clamped);
    setFinished(false);
  }

  return (
    <div className="flex flex-1 flex-col bg-black lg:flex-row">
      <div className="relative flex min-h-[60vh] flex-1 flex-col">
        <Thumb w={w} size="lg" className="absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
        <div className="relative flex items-center justify-between p-4">
          <Link href={`/watch/workout/${w.id}/`} className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold backdrop-blur">← Back</Link>
          <div className="flex gap-2">
            <button className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold backdrop-blur" title="AirPlay / Chromecast arrives with the real video player in Phase 2" disabled>📺 Cast</button>
            <button onClick={() => setShowPanel(!showPanel)} className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold backdrop-blur">{showPanel ? "Hide" : "Show"} tracking</button>
          </div>
        </div>

        <div className="relative grid flex-1 place-items-center px-6 text-center">
          {finished ? (
            <div>
              <div className="text-7xl">{evaluation?.qualifies ? "🏅" : "👏"}</div>
              <h2 className="font-display mt-4 text-4xl">{evaluation?.qualifies ? "Workout complete!" : "Nice moving!"}</h2>
              <p className="mt-2 text-paper/80">
                {evaluation?.qualifies ? "Added to your progress and streak." : "Watch more of the session to count it as complete."}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/watch/home/" className="rounded-full bg-paper px-6 py-3 font-semibold text-ink">Home</Link>
                <button onClick={() => { setBeats([]); seq.current = 0; seekTo(0); }} className="rounded-full bg-white/15 px-6 py-3 font-semibold">Do it again</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sun">{ins.displayName}</p>
              <div className="font-display mt-3 text-5xl sm:text-7xl">{playing ? cue : w.title}</div>
              <p className="mt-4 text-paper/70">{playing ? `${mmss(remaining)} remaining` : "Press play when you’re ready to move"}</p>
              {buffering && <p className="mt-3 animate-pulse text-sun">Buffering…</p>}
            </div>
          )}
        </div>

        <div className="relative space-y-3 p-4 sm:p-6">
          <input
            type="range"
            min={0}
            max={w.durationSec}
            step={1}
            value={pos}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full accent-[#ff5a36]"
            aria-label="Seek"
          />
          <div className="flex items-center gap-3">
            <button onClick={() => seekTo(pos - 10)} className="rounded-full bg-white/10 px-3 py-2 text-sm">−10s</button>
            <button
              onClick={() => { setPlaying(!playing); state.current.playing = !playing; beat({ playing: !playing }); }}
              className="grid h-14 w-14 place-items-center rounded-full bg-paper text-2xl text-ink"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button onClick={() => seekTo(pos + 10)} className="rounded-full bg-white/10 px-3 py-2 text-sm">+10s</button>
            <span className="ml-auto font-mono text-sm text-paper/70">{mmss(pos)} / {mmss(w.durationSec)}</span>
          </div>
        </div>
      </div>

      {showPanel && evaluation && (
        <aside className="w-full border-t border-white/10 bg-ink-2 p-5 text-sm lg:w-96 lg:border-l lg:border-t-0">
          <h3 className="font-display text-xl">Qualified playback</h3>
          <p className="mt-1 text-xs text-muted">Live view of the rules that decide creator royalties. Hidden from members in the real app.</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full ${evaluation.qualifies ? "bg-mint" : "bg-sun"}`} style={{ width: `${Math.min(100, evaluation.coverage * 100)}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-y-2">
            <dt className="text-muted">Distinct watched</dt><dd className="text-right font-semibold">{mmss(evaluation.distinctWatchedSec)}</dd>
            <dt className="text-muted">Coverage</dt><dd className="text-right font-semibold">{Math.round(evaluation.coverage * 100)}%</dd>
            <dt className="text-muted">Needed</dt><dd className="text-right font-semibold">{Math.round(evaluation.requiredFraction * 100)}%</dd>
            <dt className="text-muted">Credited</dt><dd className={`text-right font-semibold ${evaluation.qualifies ? "text-mint" : "text-sun"}`}>{evaluation.qualifies ? `${Math.round(evaluation.creditedSec / 60)} min` : "Not yet"}</dd>
            <dt className="text-muted">Heartbeats</dt><dd className="text-right font-semibold">{beats.length}</dd>
          </dl>
          {evaluation.flags.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Not credited because</div>
              <ul className="mt-1 space-y-1">{evaluation.flags.map((f) => <li key={f} className="text-coral-2">• {f.replaceAll("-", " ")}</li>)}</ul>
            </div>
          )}
          <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Demo controls</div>
            <label className="flex items-center justify-between gap-3">Time-lapse
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-lg bg-ink-3 px-2 py-1">
                {[1, 5, 20, 60].map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3">Simulate buffering
              <input type="checkbox" checked={buffering} onChange={(e) => setBuffering(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3">Simulate app in background
              <input type="checkbox" checked={!visible} onChange={(e) => setVisible(!e.target.checked)} />
            </label>
            <p className="text-xs text-muted">Try dragging the seek bar to the end: the jump is detected and those minutes earn nothing.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
