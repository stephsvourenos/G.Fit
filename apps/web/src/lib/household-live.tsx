"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AgeBand, CategoryId, HouseholdEntitlement, Intensity, Profile } from "@app/domain";
import { HouseholdCtx } from "./household-context";
import { PIN_UNLOCK_MS, type AccountStatus, type HouseholdState, type PinResult } from "./household-types";
import { friendlyError, supabase } from "./supabase";

/**
 * LIVE household backed by Supabase. Everything here runs with the signed-in
 * parent's own permissions; Row-Level Security in the database makes sure
 * they can only ever read or change their own household.
 *
 * The app refers to workouts as "wk-<slug>"; the database uses UUIDs. The
 * map between the two is loaded once from the published catalogue.
 */

interface ProfileRow {
  id: string;
  household_id: string;
  nickname: string;
  avatar_emoji: string;
  avatar_colour: string;
  age_band: AgeBand;
  interests: string[];
  pin_protected: boolean;
  max_intensity: Intensity | null;
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  householdId: r.household_id,
  nickname: r.nickname,
  avatar: { emoji: r.avatar_emoji, colour: r.avatar_colour },
  ageBand: r.age_band,
  interests: r.interests as CategoryId[],
  pinProtected: r.pin_protected,
  maxIntensity: r.max_intensity ?? undefined,
});

const ok: PinResult = { ok: true };
const fail = (e: unknown): PinResult => ({ ok: false, message: friendlyError(e) });

/** Per-device memory of which profile is open and when the PIN unlock expires. */
const deviceKey = (uid: string) => `gfit.device.${uid}`;
function readDevice(uid: string): { activeId?: string; unlockedUntil?: number } {
  try {
    return JSON.parse(window.sessionStorage.getItem(deviceKey(uid)) ?? "{}");
  } catch {
    return {};
  }
}
function writeDevice(uid: string, v: { activeId?: string; unlockedUntil?: number }) {
  try {
    window.sessionStorage.setItem(deviceKey(uid), JSON.stringify(v));
  } catch {
    /* storage blocked — the app still works, it just forgets on reload */
  }
}

export function LiveHouseholdProvider({ children }: { children: React.ReactNode }) {
  const db = supabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [householdId, setHouseholdId] = useState<string>();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [unlockedUntil, setUnlockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [entitlement, setEntitlement] = useState<HouseholdEntitlement>();
  const [progress, setProgressAll] = useState<Record<string, Record<string, number>>>({});
  const [favs, setFavs] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<Record<string, Array<{ workoutId: string; day: string }>>>({});
  const slugToUuid = useRef(new Map<string, string>());
  const uuidToApp = useRef(new Map<string, string>());
  // Device memory (open profile, PIN unlock) is only written after it has been read back.
  const restored = useRef(false);

  const uid = session?.user.id;

  // ---- session -------------------------------------------------------
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      data.subscription.unsubscribe();
      window.clearInterval(t);
    };
  }, [db]);

  // ---- load everything for the signed-in household ---------------------
  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;

    // Household: create it on first sign-in (the database only allows your own).
    const existing = await db.from("households").select("id").maybeSingle();
    if (existing.error) throw existing.error;
    let hh = existing.data;
    if (!hh) {
      const res = await db.from("households").insert({ owner_user_id: userId }).select("id").single();
      if (res.error) throw res.error;
      hh = res.data;
    }
    setHouseholdId(hh.id);

    const [pinSet, profRes, wkRes, entRes] = await Promise.all([
      db.rpc("household_pin_is_set"),
      db.from("profiles").select("*").order("created_at"),
      db.from("workouts").select("id, slug"),
      // Filter to our own household: staff accounts can read every household's membership.
      db.from("entitlements").select("*").eq("household_id", hh.id).maybeSingle(),
    ]);
    if (pinSet.error) throw pinSet.error;
    if (profRes.error) throw profRes.error;
    if (wkRes.error) throw wkRes.error;

    for (const w of wkRes.data ?? []) {
      slugToUuid.current.set(`wk-${w.slug}`, w.id);
      uuidToApp.current.set(w.id, `wk-${w.slug}`);
    }
    const list = (profRes.data as ProfileRow[]).map(toProfile);
    setProfiles(list);

    const e = entRes.data;
    setEntitlement(
      e
        ? {
            householdId: e.household_id,
            provider: e.provider,
            providerSubscriptionId: e.provider_subscription_id,
            status: e.status,
            currentPeriodEnd: e.current_period_end,
            graceDays: e.grace_days,
            cancelAtPeriodEnd: e.cancel_at_period_end === true,
          }
        : undefined,
    );

    // Activity for all profiles in this household (RLS returns only ours).
    const [pg, fv, cp] = await Promise.all([
      db.from("watch_progress").select("profile_id, workout_id, position_sec"),
      db.from("favourites").select("profile_id, workout_id"),
      db.from("completions").select("profile_id, workout_id, completed_on").order("created_at"),
    ]);
    const app = (id: string) => uuidToApp.current.get(id);
    const p: Record<string, Record<string, number>> = {};
    for (const r of pg.data ?? []) {
      const w = app(r.workout_id);
      if (w) (p[r.profile_id] ??= {})[w] = r.position_sec;
    }
    const f: Record<string, string[]> = {};
    for (const r of fv.data ?? []) {
      const w = app(r.workout_id);
      if (w) (f[r.profile_id] ??= []).push(w);
    }
    const c: Record<string, Array<{ workoutId: string; day: string }>> = {};
    for (const r of cp.data ?? []) {
      const w = app(r.workout_id);
      if (w) (c[r.profile_id] ??= []).push({ workoutId: w, day: r.completed_on });
    }
    setProgressAll(p);
    setFavs(f);
    setDone(c);

    const dev = readDevice(userId);
    setActiveId(list.some((x) => x.id === dev.activeId) ? dev.activeId : undefined);
    setUnlockedUntil(dev.unlockedUntil ?? 0);
    restored.current = true;
    setStatus(!pinSet.data ? "needs-pin" : list.length === 0 ? "needs-profiles" : "ready");
  }, [db, session]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      restored.current = false;
      /* eslint-disable react-hooks/set-state-in-effect */
      setStatus("signed-out");
      setProfiles([]);
      setHouseholdId(undefined);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    load().catch((e) => {
      console.error("[household] load failed", e);
      setStatus("signed-out");
    });
  }, [session, load]);

  useEffect(() => {
    if (uid && restored.current) writeDevice(uid, { activeId, unlockedUntil });
  }, [uid, activeId, unlockedUntil]);

  // ---- actions -------------------------------------------------------
  const value = useMemo<HouseholdState>(() => {
    const pid = activeId ?? "";
    const wk = (appId: string) => slugToUuid.current.get(appId);
    const pinUnlocked = unlockedUntil > now;

    return {
      mode: "live",
      status,
      email: session?.user.email,
      ready: status === "ready",
      profiles,
      activeProfile: profiles.find((p) => p.id === activeId),
      selectProfile: setActiveId,
      clearProfile: () => setActiveId(undefined),
      pinUnlocked,
      unlockWithPin: async (pin) => {
        const { data, error } = await db.rpc("verify_household_pin", { pin });
        if (error) return fail(error);
        if (!data) return { ok: false, message: "That PIN didn’t match. Try again." };
        setUnlockedUntil(Date.now() + PIN_UNLOCK_MS);
        setNow(Date.now());
        return ok;
      },
      setPin: async (pin) => {
        const { error } = await db.rpc("set_household_pin", { new_pin: pin });
        if (error) return fail(error);
        setUnlockedUntil(Date.now() + PIN_UNLOCK_MS);
        setNow(Date.now());
        if (status === "needs-pin") setStatus(profiles.length ? "ready" : "needs-profiles");
        return ok;
      },
      lockPin: () => {
        setUnlockedUntil(0);
        // Also end the unlock on the server, so adult-profile videos need the PIN again.
        void db.rpc("lock_household_pin").then(({ error }) => error && console.error("[household] lock", error.message));
      },
      addProfile: async (p) => {
        if (!householdId) return { ok: false, message: "Your household isn’t loaded yet." };
        const { data, error } = await db
          .from("profiles")
          .insert({
            household_id: householdId,
            nickname: p.nickname.trim(),
            avatar_emoji: p.avatar.emoji,
            avatar_colour: p.avatar.colour,
            age_band: p.ageBand,
            interests: p.interests,
            pin_protected: p.pinProtected,
            max_intensity: p.maxIntensity ?? null,
          })
          .select("*")
          .single();
        if (error) return fail(error);
        setProfiles((list) => [...list, toProfile(data as ProfileRow)]);
        if (status === "needs-profiles") setStatus("ready");
        return ok;
      },
      removeProfile: async (id) => {
        // Deleting a profile also deletes its activity (database cascade).
        const { error } = await db.from("profiles").delete().eq("id", id);
        if (error) return fail(error);
        setProfiles((list) => list.filter((p) => p.id !== id));
        if (activeId === id) setActiveId(undefined);
        return ok;
      },
      progress: progress[pid] ?? {},
      setProgress: (workoutId, sec) => {
        setProgressAll((all) => ({ ...all, [pid]: { ...(all[pid] ?? {}), [workoutId]: sec } }));
        const w = wk(workoutId);
        if (!w || !pid) return;
        void db
          .from("watch_progress")
          .upsert({ profile_id: pid, workout_id: w, position_sec: Math.max(0, Math.floor(sec)), updated_at: new Date().toISOString() })
          .then(({ error }) => error && console.error("[household] progress", error.message));
      },
      favourites: favs[pid] ?? [],
      toggleFavourite: (workoutId) => {
        const w = wk(workoutId);
        if (!w || !pid) return;
        const has = (favs[pid] ?? []).includes(workoutId);
        setFavs((all) => {
          const cur = all[pid] ?? [];
          return { ...all, [pid]: has ? cur.filter((x) => x !== workoutId) : [...cur, workoutId] };
        });
        const q = has
          ? db.from("favourites").delete().eq("profile_id", pid).eq("workout_id", w)
          : db.from("favourites").insert({ profile_id: pid, workout_id: w });
        void q.then(({ error }) => error && console.error("[household] favourite", error.message));
      },
      completed: done[pid] ?? [],
      markCompleted: (workoutId) => {
        const w = wk(workoutId);
        if (!w || !pid) return;
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
        setDone((all) => ({ ...all, [pid]: [...(all[pid] ?? []), { workoutId, day }] }));
        void db
          .from("completions")
          .insert({ profile_id: pid, workout_id: w })
          .then(({ error }) => error && console.error("[household] completion", error.message));
      },
      entitlement,
      exportData: async () => {
        const { data, error } = await db.rpc("export_my_household");
        if (error) throw error;
        return data;
      },
      closeAccount: async () => {
        const { error } = await db.rpc("delete_my_account");
        if (error) return fail(error);
        if (uid) writeDevice(uid, {});
        await db.auth.signOut({ scope: "local" });
        return ok;
      },
      signOut: async () => {
        if (uid) writeDevice(uid, {});
        setActiveId(undefined);
        setUnlockedUntil(0);
        await db.auth.signOut();
      },
    };
  }, [db, status, session, profiles, activeId, unlockedUntil, now, householdId, progress, favs, done, entitlement, uid]);

  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}
