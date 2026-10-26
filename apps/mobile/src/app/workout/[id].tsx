import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AGE_BAND_LABEL, CATEGORY_LABEL, decidePlayback, formatDuration } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { useHousehold } from "@/lib/household";
import { Thumb } from "@/ui/Thumb";
import { C } from "@/ui/theme";

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useHousehold();
  const w = workouts.find((x) => x.id === id);
  if (!w || !h.active) return <Text style={{ color: C.paper, padding: 24 }}>Not found</Text>;
  const ins = instructors.find((i) => i.id === w.instructorId)!;
  const decision = decidePlayback({ entitlement: h.entitlement, profile: h.active, workout: w, pinUnlocked: h.pinUnlocked, now: new Date() });
  return (
    <ScrollView style={{ backgroundColor: C.ink }}>
      <Thumb w={w} big style={{ height: 240 }} />
      <View style={{ padding: 20 }}>
        <Text style={s.cat}>{CATEGORY_LABEL[w.category]}</Text>
        <Text style={s.title}>{w.title}</Text>
        <Text style={s.meta}>{formatDuration(w.durationSec)} · {w.intensity} · {ins.displayName}</Text>
        <Text style={s.body}>{w.description}</Text>
        {decision.allowed ? (
          <Pressable onPress={() => router.push(`/play/${w.id}`)} style={s.cta} accessibilityRole="button">
            <Text style={s.ctaText}>▶  Start workout</Text>
          </Pressable>
        ) : (
          <Text style={[s.meta, { marginTop: 20 }]}>🔒 Not available on this profile ({decision.reason})</Text>
        )}
        <Text style={s.small}>Suitable for {w.ageBands.map((b) => AGE_BAND_LABEL[b]).join(", ")}. Clear some space and stop if anything hurts.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cat: { color: C.sun, fontWeight: "700" },
  title: { color: C.paper, fontSize: 30, fontWeight: "800", marginTop: 4 },
  meta: { color: C.muted, marginTop: 6 },
  body: { color: C.paper, opacity: 0.85, marginTop: 14, fontSize: 16, lineHeight: 22 },
  cta: { backgroundColor: C.coral, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  small: { color: C.muted, fontSize: 12, marginTop: 18 },
});
