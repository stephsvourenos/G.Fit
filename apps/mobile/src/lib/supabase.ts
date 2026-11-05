import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

/**
 * Public values only (the project address and the publishable key). Data is
 * protected by the database's Row-Level Security rules, never by hiding these.
 * Put them in apps/mobile/.env (see .env.example). Without them the app runs on
 * built-in sample data.
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(URL && KEY);

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase is not configured");
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // Keep the sign-in fresh only while the app is open.
    if (Platform.OS !== "web") {
      AppState.addEventListener("change", (state) => {
        if (state === "active") client!.auth.startAutoRefresh();
        else client!.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(msg)) return "That email and password don’t match.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first (check your inbox), then sign in.";
  if (/network|fetch/i.test(msg)) return "Can’t reach the server — check your internet connection.";
  return "Something went wrong. Please try again.";
}
