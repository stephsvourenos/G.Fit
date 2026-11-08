import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { brand } from "@app/config";
import { useHousehold } from "@/lib/household";
import { C } from "./theme";

/** Household sign-in. Accounts, profiles and the PIN are created on the website. */
export function SignIn() {
  const h = useHousehold();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!email || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError(undefined);
    const err = await h.signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={s.card}>
        <Text style={s.logo}>{brand.name}</Text>
        <Text style={s.tagline}>{brand.tagline}</Text>
        <Text style={s.intro}>Short, fun workouts the whole family can do together — from little kids to grown-ups, with a profile for everyone.</Text>
        <Text style={s.h1}>Sign in</Text>
        <Text style={s.sub}>Use your family’s household account.</Text>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={C.muted}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          accessibilityLabel="Password"
        />
        {error && <Text style={s.err} accessibilityRole="alert">{error}</Text>}
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.btn, (pressed || busy) && { opacity: 0.7 }]} accessibilityRole="button">
          {busy ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Sign in</Text>}
        </Pressable>
        <Text style={s.note}>
          New here? The account owner sets up the family membership, profiles and parent PIN on our website. Forgotten
          password? Reset it on the website too.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink, justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, alignSelf: "center" },
  logo: { color: C.coral, fontWeight: "900", fontSize: 40, letterSpacing: -0.5 },
  tagline: { color: C.paper, fontWeight: "700", fontSize: 18, marginTop: 4 },
  intro: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 28 },
  h1: { color: C.paper, fontSize: 32, fontWeight: "700", marginTop: 12 },
  sub: { color: C.muted, marginTop: 4, marginBottom: 20 },
  input: { backgroundColor: C.ink3, color: C.paper, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginTop: 10 },
  err: { color: C.coral, marginTop: 12 },
  btn: { backgroundColor: C.paper, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  btnText: { color: C.ink, fontWeight: "800", fontSize: 16 },
  note: { color: C.muted, fontSize: 12, marginTop: 24, lineHeight: 18 },
});
