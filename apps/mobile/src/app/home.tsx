import { Link, router } from "expo-router";
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { buildHomeRows, CATEGORY_LABEL, formatDuration } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { useHousehold } from "@/lib/household";
import { Thumb } from "@/ui/Thumb";
import { C, FILL } from "@/ui/theme";

export default function Home() {
  const h = useHousehold();
  if (!h.active) {
    return (
      <SafeAreaView style={s.root}>
        <Link href="/" style={{ color: C.paper, padding: 24 }}>Choose a profile</Link>
      </SafeAreaView>
    );
  }
  const rows = buildHomeRows({ profile: h.active, workouts, instructors, progress: h.progress, favourites: [], completed: h.completed });
  const hero = rows.find((r) => r.id === "recommended")?.workouts[0];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView>
        <View style={s.top}>
          <Text style={s.hi}>Hi {h.active.nickname} 👋</Text>
          <Pressable onPress={() => router.replace("/")} style={s.switch}><Text style={{ fontSize: 22 }}>{h.active.avatar.emoji}</Text></Pressable>
        </View>
        {hero && (
          <Pressable onPress={() => router.push(`/workout/${hero.id}`)} style={s.hero}>
            <Thumb w={hero} big style={FILL} />
            <View style={s.heroShade} />
            <View style={{ padding: 18 }}>
              <Text style={s.kicker}>Picked for you · {formatDuration(hero.durationSec)}</Text>
              <Text style={s.heroTitle}>{hero.title}</Text>
            </View>
          </Pressable>
        )}
        {rows.map((row) => (
          <View key={row.id} style={{ marginTop: 26 }}>
            <Text style={s.rowTitle}>{row.title}</Text>
            <FlatList
              horizontal
              data={row.workouts}
              keyExtractor={(w) => w.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item: w }) => (
                <Pressable onPress={() => router.push(`/workout/${w.id}`)} style={s.card} accessibilityRole="button" accessibilityLabel={w.title}>
                  <Thumb w={w} style={s.cardThumb} />
                  {row.progress?.[w.id] ? <View style={[s.progress, { width: `${Math.min(100, (row.progress[w.id]! / w.durationSec) * 100)}%` }]} /> : null}
                  <View style={{ padding: 10 }}>
                    <Text style={s.cat}>{CATEGORY_LABEL[w.category]} · {formatDuration(w.durationSec)}</Text>
                    <Text style={s.cardTitle} numberOfLines={2}>{w.title}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },
  hi: { color: C.paper, fontSize: 26, fontWeight: "700" },
  switch: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.ink3, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: 20, marginTop: 16, height: 220, borderRadius: 24, overflow: "hidden", justifyContent: "flex-end" },
  heroShade: { ...FILL, backgroundColor: "rgba(0,0,0,0.25)" },
  kicker: { color: C.sun, fontWeight: "700", fontSize: 12 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  rowTitle: { color: C.paper, fontSize: 20, fontWeight: "700", marginLeft: 20, marginBottom: 10 },
  card: { width: 200, borderRadius: 18, backgroundColor: C.ink2, overflow: "hidden" },
  cardThumb: { height: 112 },
  progress: { height: 3, backgroundColor: C.coral },
  cat: { color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  cardTitle: { color: C.paper, fontSize: 15, fontWeight: "600", marginTop: 2 },
});
