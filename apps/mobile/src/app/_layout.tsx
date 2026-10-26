import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HouseholdProvider } from "@/lib/household";
import { C } from "@/ui/theme";

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.ink, card: C.ink, text: C.paper, primary: C.coral } };

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
