"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Uses only the PUBLIC project URL and publishable
 * key — Row-Level Security in the database decides what each signed-in user
 * can read or change. No secret keys ever reach the browser.
 *
 * When these two values are missing the app runs in MOCK mode (sample data).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured (running in mock mode)");
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return client;
}

/** Turn a database / auth error into a sentence a parent can act on. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return "That email and password don’t match. Check them and try again.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email first — open the link we sent you.";
  if (/User already registered/i.test(msg)) return "There’s already an account with that email. Try signing in instead.";
  if (/maximum of \d+ profiles/i.test(msg)) return "Your household already has the maximum number of profiles.";
  if (/Too many attempts/i.test(msg)) return msg.replace(/^.*?(Too many attempts.*)$/i, "$1") + ".";
  if (/rate limit/i.test(msg)) return "Too many tries in a short time. Please wait a minute and try again.";
  if (/Password should be/i.test(msg)) return "Please choose a longer password (at least 10 characters).";
  if (/fetch|network/i.test(msg)) return "We couldn’t reach the server. Check your internet connection and try again.";
  return msg;
}
