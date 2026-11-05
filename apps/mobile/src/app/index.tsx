import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AGE_BAND_LABEL, type Profile } from "@app/domain";
import { brand } from "@app/config";
import { useHousehold } from "@/lib/household";
import { PinModal } from "@/ui/PinModal";
import { SignIn } from "@/ui/SignIn";
import { C } from "@/ui/theme";

export default function ProfilePicker() {
  const h = useHousehold();
  const [pending, setPending] = useState<Profile | null>(null);

  const choose = (p: Profile) => {
    if (p.pinProtected && !h.pinUnlocked) return setPending(p);
    if (!p.pinProtected) h.lock();
    h.select(p.id);
    router.push("/home");
  };

  if (h.status === "loading") {
    return <View style={[s.root, { justifyContent: "center" }]}><ActivityIndicator color={C.paper} /></View>;
  }
  if (h.status === "signed-out") return <SignIn />;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.brand}>{brand.name}</Text>
        <Text style={s.h1}>Who’s moving today?</Text>
        <View style={s.grid}>
          {h.profiles.map((p) => (
            <Pressable key={p.id} onPress={() => choose(p)} style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`Open ${p.nickname}`}>
              <View style={[s.avatar, { backgroundColor: p.avatar.colour }]}><Text style={{ fontSize: 44 }}>{p.avatar.emoji}</Text></View>
              <Text style={s.name}>{p.nickname}</Text>
              <Text style={s.meta}>{p.pinProtected ? "🔒 " : ""}{AGE_BAND_LABEL[p.ageBand]}</Text>
            </Pressable>
          ))}
        </View>
        {h.status === "no-profiles" && (
          <Text style={s.empty}>No profiles yet. Add your family’s profiles and parent PIN on our website, then come back.</Text>
        )}
        <Text style={s.note}>Membership and billing are managed by the account owner outside this app.</Text>
        {h.mode === "live" && (
          <View style={s.row}>
            {h.status === "no-profiles" && <Pressable onPress={h.reload}><Text style={s.link}>Refresh</Text></Pressable>}
            <Pressable onPress={() => void h.signOut()} accessibilityRole="button"><Text style={s.link}>Sign out{h.email ? ` (${h.email})` : ""}</Text></Pressable>
          </View>
        )}
      </ScrollView>
      <PinModal
        visible={!!pending}
        title={`Open ${pending?.nickname ?? ""}’s profile`}
        onCancel={() => setPending(null)}
        hint={h.mode === "demo" ? "Parent PIN (demo: 1234)" : "Parent PIN"}
        onSubmit={async (pin) => {
          const err = await h.unlock(pin);
          if (err || !pending) return err;
          h.select(pending.id);
          setPending(null);
          router.push("/home");
          return undefined;
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },
  content: { padding: 24, paddingTop: 48, alignItems: "center" },
  brand: { color: C.coral, fontWeight: "800", letterSpacing: 1 },
  h1: { color: C.paper, fontSize: 32, fontWeight: "700", marginTop: 12, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 20, marginTop: 32 },
  tile: { width: 130, alignItems: "center" },
  avatar: { width: 104, height: 104, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  name: { color: C.paper, fontWeight: "700", marginTop: 10, fontSize: 16 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  empty: { color: C.paper, textAlign: "center", marginTop: 24, maxWidth: 320 },
  row: { flexDirection: "row", gap: 20, marginTop: 16 },
  link: { color: C.sun, fontWeight: "700", fontSize: 13 },
  note: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 40, maxWidth: 320 },
});
