import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { Workout } from "@app/domain";

/** Placeholder artwork: two-tone block + category emoji (real thumbnails come from Mux in Phase 2). */
export function Thumb({ w, style, big }: { w: Workout; style?: ViewStyle; big?: boolean }) {
  return (
    <View style={[styles.box, { backgroundColor: w.thumbnail.from }, style]}>
      <View style={[styles.wash, { backgroundColor: w.thumbnail.to }]} />
      <Text style={[styles.emoji, big && { fontSize: 96, right: 24, bottom: 16 }]}>{w.thumbnail.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden" },
  wash: { position: "absolute", right: -40, top: -40, width: "90%", height: "140%", opacity: 0.6, borderRadius: 999, transform: [{ rotate: "25deg" }] },
  emoji: { position: "absolute", right: 10, bottom: 4, fontSize: 44, transform: [{ rotate: "-10deg" }] },
});
