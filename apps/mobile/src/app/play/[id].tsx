import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { evaluateSession, type Heartbeat, type Workout } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { useHousehold } from "@/lib/household";
import { Thumb } from "@/ui/Thumb";
import { C, FILL } from "@/ui/theme";

/**
 * PROTOTYPE player (time-lapsed 20×). Phase 2 swaps the placeholder for a real
 * Mux stream in a native video player; the heartbeat logic stays the same.
 * App backgrounding is a real signal here (AppState).
 */
export default function PlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = workouts.find((x) => x.id === id);
  if (!w) return <Text style={{ color: C.paper, padding: 24 }}>Workout not found</Text>;
  return <Player w={w} />;
}

function Player({ w }: { w: Workout }) {
  const h = useHousehold();
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const st = useRef({ pos: 0, playing: false, visible: true, clock: 0, last: 0, seq: 0 });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => (st.current.visible = s === "active"));
    const t = setInterval(() => {
      const r = st.current;
      r.clock += 2000; // 100ms real = 2s simulated
      if (r.playing && r.pos < w.durationSec) {
        r.pos = Math.min(w.durationSec, r.pos + 2);
        setPos(r.pos);
      }
      if (r.clock - r.last >= 12000 || r.pos >= w.durationSec) {
        const hb: Heartbeat = { sessionId: "m", seq: r.seq++, receivedAt: r.clock, positionSec: r.pos, playing: r.playing, visible: r.visible, buffering: false, playbackRate: 1 };
        setBeats((b) => [...b, hb]);
        r.last = r.clock;
        if (r.pos >= w.durationSec) r.playing = false;
      }
    }, 100);
    return () => { clearInterval(t); sub.remove(); };
  }, [w.durationSec]);

  const ev = evaluateSession(
    { sessionId: "m", householdId: h.active?.householdId ?? "", profileId: h.active?.id ?? "", workoutId: w.id, creatorId: w.creatorId, deviceId: "phone", durationSec: w.durationSec, tokenIssued: true, accessibilityMode: false, startedAt: 0 },
    beats,
  );
  const done = pos >= w.durationSec;
  useEffect(() => {
    if (done && ev.qualifies) h.markCompleted(w.id);
    h.setProgress(w.id, Math.floor(pos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const ins = instructors.find((i) => i.id === w.instructorId)!;
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;

  return (
    <SafeAreaView style={s.root}>
      <Thumb w={w} big style={FILL} />
      <View style={s.shade} />
      <Pressable onPress={() => router.back()} style={s.close}><Text style={{ color: "#fff", fontWeight: "700" }}>✕</Text></Pressable>
      <View style={s.center}>
        <Text style={s.coach}>{ins.displayName.toUpperCase()}</Text>
        <Text style={s.title}>{done ? (ev.qualifies ? "Workout complete! 🏅" : "Nice moving!") : w.title}</Text>
        <Text style={s.time}>{mmss(pos)} / {mmss(w.durationSec)}</Text>
      </View>
      <View style={s.bar}><View style={[s.fill, { width: `${(pos / w.durationSec) * 100}%` }]} /></View>
      <Pressable
        onPress={() => { st.current.playing = !st.current.playing; setPlaying(st.current.playing); }}
        style={s.play}
        accessibilityLabel={playing ? "Pause" : "Play"}
      >
        <Text style={{ fontSize: 26, color: C.ink }}>{playing ? "❚❚" : "▶"}</Text>
      </Pressable>
      <Text style={s.track}>Qualified: {Math.round(ev.coverage * 100)}% of {Math.round(ev.requiredFraction * 100)}% needed{ev.qualifies ? " ✓" : ""}</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "flex-end", paddingBottom: 30 },
  shade: { ...FILL, backgroundColor: "rgba(0,0,0,0.55)" },
  close: { position: "absolute", top: 56, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  coach: { color: C.sun, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#fff", fontSize: 34, fontWeight: "800", textAlign: "center", marginTop: 8 },
  time: { color: "rgba(255,255,255,0.75)", marginTop: 10, fontVariant: ["tabular-nums"] },
  bar: { height: 4, marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  fill: { height: 4, backgroundColor: C.coral, borderRadius: 2 },
  play: { alignSelf: "center", marginTop: 20, width: 68, height: 68, borderRadius: 34, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" },
  track: { color: C.muted, textAlign: "center", marginTop: 14, fontSize: 12 },
});
