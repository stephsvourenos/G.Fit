import { useEventListener } from "expo";
import { router } from "expo-router";
import { useVideoPlayer, VideoAirPlayButton, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { evaluateSession, type Heartbeat, type Workout } from "@app/domain";
import { useHousehold } from "@/lib/household";
import { heartbeatMs, sendHeartbeat, streamUrl } from "@/lib/video";
import { C } from "./theme";

/**
 * Real, signed Mux playback in the phone's own video player. Heartbeats go to
 * the server (which stamps the arrival time) every few seconds and on
 * play / pause / end. Leaving the app counts as "not visible", so nothing is
 * credited while it plays in the background. AirPlay to a TV works on iPhone.
 */
export function NativePlayer({ w, playbackId, tokens, sessionId, coach }: {
  w: Workout;
  playbackId: string;
  tokens: { playback: string };
  sessionId?: string;
  coach: string;
}) {
  const h = useHousehold();
  const startAt = Math.min(h.progress[w.id] ?? 0, Math.max(0, w.durationSec - 5));
  const player = useVideoPlayer(
    { uri: streamUrl(playbackId, tokens.playback), contentType: "hls", metadata: { title: w.title, artist: coach } },
    (p) => {
      p.allowsExternalPlayback = true;
      if (startAt > 0) p.currentTime = startAt;
      p.play();
    },
  );

  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const [duration, setDuration] = useState(w.durationSec);
  const [ended, setEnded] = useState(false);
  const seq = useRef(0);
  const visible = useRef(AppState.currentState === "active");
  const [startedAt] = useState(() => Date.now());

  const beat = () => {
    let pos = 0;
    let playing = false;
    let buffering = false;
    let rate = 1;
    let casting = false;
    try {
      pos = player.currentTime;
      playing = player.playing;
      buffering = player.status === "loading";
      rate = player.playbackRate;
      casting = player.isExternalPlaybackActive === true; // AirPlay to a TV (iPhone)
    } catch {
      return; // player already released
    }
    const hb: Heartbeat = {
      sessionId: sessionId ?? "local",
      seq: seq.current++,
      receivedAt: Date.now(),
      positionSec: pos,
      playing,
      visible: visible.current,
      buffering,
      playbackRate: rate,
      casting,
    };
    if (sessionId) {
      sendHeartbeat(sessionId, { seq: hb.seq, position_sec: pos, playing, visible: hb.visible, buffering, playback_rate: rate, casting });
    }
    setBeats((b) => [...b, hb]);
  };

  useEventListener(player, "sourceLoad", ({ duration: d }) => d > 0 && setDuration(Math.round(d)));
  useEventListener(player, "playingChange", ({ isPlaying }) => {
    beat();
    if (!isPlaying) h.setProgress(w.id, Math.floor(player.currentTime));
  });
  useEventListener(player, "isExternalPlaybackActiveChange", () => beat());
  useEventListener(player, "playToEnd", () => {
    beat();
    setEnded(true);
    h.setProgress(w.id, 0);
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      visible.current = state === "active";
      beat();
    });
    const t = setInterval(beat, heartbeatMs(duration));
    return () => {
      clearInterval(t);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const ev = useMemo(
    () =>
      evaluateSession(
        {
          sessionId: sessionId ?? "local",
          householdId: h.active?.householdId ?? "",
          profileId: h.active?.id ?? "",
          workoutId: w.id,
          creatorId: w.creatorId,
          deviceId: "phone",
          durationSec: duration,
          tokenIssued: true,
          accessibilityMode: false,
          startedAt,
        },
        beats,
      ),
    [beats, duration, h.active, w, sessionId, startedAt],
  );

  useEffect(() => {
    if (ended && ev.qualifies) h.markCompleted(w.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.top}>
        <Pressable onPress={() => router.back()} style={s.close} accessibilityLabel="Close"><Text style={{ color: "#fff", fontWeight: "700" }}>✕</Text></Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.coach}>{coach.toUpperCase()}</Text>
          <Text style={s.title} numberOfLines={1}>{w.title}</Text>
        </View>
        {Platform.OS === "ios" ? <VideoAirPlayButton tint="white" activeTint={C.sun} style={s.airplay} /> : <View style={s.airplay} />}
      </View>
      <VideoView
        player={player}
        style={s.video}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
      />
      <Text style={s.track}>
        {ended
          ? ev.qualifies ? "🏅 Workout complete — added to your progress." : "👏 Nice moving! Watch more of the session to count it as complete."
          : `Counted so far: ${Math.round(ev.coverage * 100)}% (needs ${Math.round(ev.requiredFraction * 100)}%)`}
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  airplay: { width: 40, height: 40 },
  coach: { color: C.sun, fontWeight: "800", letterSpacing: 2, fontSize: 11 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  video: { flex: 1, width: "100%" },
  track: { color: C.muted, textAlign: "center", padding: 14, fontSize: 12 },
});
