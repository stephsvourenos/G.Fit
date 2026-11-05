import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
import type { Workout } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { useHousehold } from "@/lib/household";
import { DENIAL_MESSAGE, requestPlayback, type PlaybackGrant } from "@/lib/video";
import { NativePlayer } from "@/ui/NativePlayer";
import { SimulatedPlayer } from "@/ui/SimulatedPlayer";
import { C } from "@/ui/theme";

export default function PlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useHousehold();
  const w = workouts.find((x) => x.id === id);
  if (!w) return <Text style={{ color: C.paper, padding: 24 }}>Workout not found</Text>;
  if (h.mode === "demo") return <SimulatedPlayer w={w} />;
  return <LivePlayer w={w} />;
}

/** Asks the server for permission first; the server re-checks membership, age and PIN. */
function LivePlayer({ w }: { w: Workout }) {
  const h = useHousehold();
  const [grant, setGrant] = useState<PlaybackGrant>();
  const [error, setError] = useState<string>();
  const profileId = h.active?.id;

  useEffect(() => {
    if (!profileId) return;
    let live = true;
    requestPlayback(w.id, profileId)
      .then((g) => live && setGrant(g))
      .catch(() => live && setError("Couldn’t start the video. Check your connection and try again."));
    return () => {
      live = false;
    };
  }, [w.id, profileId]);

  const coach = instructors.find((i) => i.id === w.instructorId)?.displayName ?? "";
  if (!profileId) return <Message text="Please choose a profile first." />;
  if (error) return <Message text={error} />;
  if (!grant) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.paper} />
      </SafeAreaView>
    );
  }
  if (!grant.allowed) return <Message text={DENIAL_MESSAGE[grant.reason] ?? "This workout isn’t available."} />;
  if (!grant.video) return <SimulatedPlayer w={w} />;
  return <NativePlayer w={w} playbackId={grant.playbackId} tokens={grant.tokens} sessionId={grant.sessionId} coach={coach} />;
}

function Message({ text }: { text: string }) {
  return (
    <SafeAreaView style={s.center}>
      <Text style={s.msg}>{text}</Text>
      <Pressable onPress={() => router.back()} style={s.btn} accessibilityRole="button">
        <Text style={s.btnText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", padding: 24 },
  msg: { color: C.paper, fontSize: 18, textAlign: "center", maxWidth: 320 },
  btn: { marginTop: 20, backgroundColor: C.paper, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: C.ink, fontWeight: "800" },
});
