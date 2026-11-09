import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { installErrorReporter, reportError } from "@/lib/errors";
import { HouseholdProvider } from "@/lib/household";
import { C } from "@/ui/theme";

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.ink, card: C.ink, text: C.paper, primary: C.coral } };

installErrorReporter();

/** Shown if a screen crashes; the problem is reported to Admin → System health. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => reportError(`Screen crashed: ${error.message}`), [error]);
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: C.paper, fontSize: 24, fontWeight: "800" }}>Something went wrong</Text>
      <Text style={{ color: C.muted, marginTop: 8, textAlign: "center" }}>We’ve been told about it. Please try again.</Text>
      <Pressable onPress={retry} style={{ marginTop: 20, backgroundColor: C.paper, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}>
        <Text style={{ color: C.ink, fontWeight: "800" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <HouseholdProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: C.ink }, headerTintColor: C.paper, contentStyle: { backgroundColor: C.ink } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="workout/[id]" options={{ title: "" }} />
          <Stack.Screen name="play/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        </Stack>
      </ThemeProvider>
    </HouseholdProvider>
  );
}
