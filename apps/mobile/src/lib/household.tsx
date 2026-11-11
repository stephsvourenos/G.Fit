import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { coachPortraitUrl, type AgeBand, type CategoryId, type HouseholdEntitlement, type Intensity, type Profile } from "@app/domain";
import { DEMO_PIN, demoHouseholdId, demoProfiles, demoProgress } from "@app/mock-data";
import { friendlyError, supabase, SUPABASE_URL, supabaseConfigured } from "./supabase";

/**
 * Household state for the phone app. With Supabase configured it uses the real
 * household sign-in, profiles and the server-checked parent PIN; otherwise it
 * runs on built-in sample data.
 *
 * The app is SIGN-IN ONLY: families create their account, profiles and PIN on
 * the website. No purchase screens until the app-store billing decision is made.
 */
export type Status = "loading" | "signed-out" | "no-profiles" | "ready";

interface State {
  mode: "demo" | "live";
  status: Status;
  email?: string;
  profiles: Profile[];
  active?: Profile;
  select: (id: string) => void;
  pinUnlocked: boolean;
  /** Resolves to an error message, or undefined when the PIN was right. */
  unlock: (pin: string) => Promise<string | undefined>;
  lock: () => void;
  progress: Record<string, number>;
  setProgress: (workoutId: string, sec: number) => void;
  completed: string[];
  markCompleted: (workoutId: string) => void;
  entitlement?: HouseholdEntitlement;
  signIn: (email: string, password: string) => Promise<string | undefined>;
  signOut: () => Promise<void>;
  reload: () => void;
}

const PIN_UNLOCK_MS = 10 * 60_000; // matches the server's unlock window
const Ctx = createContext<State | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  return supabaseConfigured ? <LiveProvider>{children}</LiveProvider> : <DemoProvider>{children}</DemoProvider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("HouseholdProvider missing");
  return v;
}

/* ---------------------------------------------------------------- demo */

function DemoProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>();
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [progress, setProgressAll] = useState<Record<string, Record<string, number>>>(demoProgress);
  const [completed, setCompleted] = useState<Record<string, string[]>>({});

  const value = useMemo<State>(() => {
    const active = demoProfiles.find((p) => p.id === activeId);
    const pid = active?.id ?? "";
    return {
      mode: "demo",
      status: "ready",
      profiles: demoProfiles,
      active,
      select: setActiveId,
      pinUnlocked,
      unlock: async (pin) => {
        if (pin !== DEMO_PIN) return "That PIN didn’t match.";
        setPinUnlocked(true);
        return undefined;
      },
      lock: () => setPinUnlocked(false),
      progress: progress[pid] ?? {},
      setProgress: (w, s) => setProgressAll((all) => ({ ...all, [pid]: { ...(all[pid] ?? {}), [w]: s } })),
      completed: completed[pid] ?? [],
      markCompleted: (w) => setCompleted((all) => ({ ...all, [pid]: [...(all[pid] ?? []), w] })),
      entitlement: {
        householdId: demoHouseholdId,
        provider: "mock",
        providerSubscriptionId: "sub_mock_demo",
        status: "active",
        currentPeriodEnd: "2099-01-01T00:00:00Z",
        graceDays: 3,
      },
      signIn: async () => undefined,
      signOut: async () => undefined,
      reload: () => undefined,
    };
  }, [activeId, pinUnlocked, progress, completed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------------------------------------------------------- live */

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
  coach?: { id: string; display_name: string; portrait_path: string | null } | null;
}

/** Profiles plus the coach portrait they picked (if any). */
const PROFILE_COLS = "*, coach:instructors!avatar_instructor_id(id, display_name, portrait_path)";

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  householdId: r.household_id,
  nickname: r.nickname,
  avatar: {
    emoji: r.avatar_emoji,
    colour: r.avatar_colour,
    ...(r.coach?.portrait_path ? { coach: { id: r.coach.id, name: r.coach.display_name, imageUrl: coachPortraitUrl(SUPABASE_URL ?? "", r.coach.portrait_path) } } : {}),
  },
  ageBand: r.age_band,
  interests: r.interests as CategoryId[],
  pinProtected: r.pin_protected,
  maxIntensity: r.max_intensity ?? undefined,
});

function LiveProvider({ children }: { children: React.ReactNode }) {
  const db = supabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [unlockedUntil, setUnlockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [entitlement, setEntitlement] = useState<HouseholdEntitlement>();
  const [progress, setProgressAll] = useState<Record<string, Record<string, number>>>({});
  const [done, setDone] = useState<Record<string, string[]>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const slugToUuid = useRef(new Map<string, string>());

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_e, s) => setSession(s));
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      data.subscription.unsubscribe();
      clearInterval(t);
    };
  }, [db]);

  const load = useCallback(async () => {
    const { data: u } = await db.auth.getUser();
    const hh = await db.from("households").select("id").eq("owner_user_id", u.user?.id ?? "").maybeSingle();
    if (hh.error) throw hh.error;
    const householdId = hh.data?.id ?? "";
    // Filter to our own household: staff accounts can read every household's membership.
    const [profRes, wkRes, entRes] = await Promise.all([
      db.from("profiles").select(PROFILE_COLS).eq("household_id", householdId).order("created_at"),
      db.from("workouts").select("id, slug"),
      db.from("entitlements").select("*").eq("household_id", householdId).maybeSingle(),
    ]);
    if (profRes.error) throw profRes.error;
    if (wkRes.error) throw wkRes.error;
    const appId = new Map<string, string>();
    for (const w of wkRes.data ?? []) {
      slugToUuid.current.set(`wk-${w.slug}`, w.id);
      appId.set(w.id, `wk-${w.slug}`);
    }
    const list = (profRes.data as ProfileRow[]).map(toProfile);
    const e = entRes.data;
    const [pg, cp] = await Promise.all([
      db.from("watch_progress").select("profile_id, workout_id, position_sec"),
      db.from("completions").select("profile_id, workout_id"),
    ]);
    const p: Record<string, Record<string, number>> = {};
    for (const r of pg.data ?? []) {
      const w = appId.get(r.workout_id);
      if (w) (p[r.profile_id] ??= {})[w] = r.position_sec;
    }
    const c: Record<string, string[]> = {};
    for (const r of cp.data ?? []) {
      const w = appId.get(r.workout_id);
      if (w) (c[r.profile_id] ??= []).push(w);
    }
    return {
      list,
      p,
      c,
      ent: e
        ? {
            householdId: e.household_id,
            provider: e.provider,
            providerSubscriptionId: e.provider_subscription_id,
            status: e.status,
            currentPeriodEnd: e.current_period_end,
            graceDays: e.grace_days,
          }
        : undefined,
    };
  }, [db]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setStatus("signed-out");
      setProfiles([]);
      setActiveId(undefined);
      setUnlockedUntil(0);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    load()
      .then(({ list, p, c, ent }) => {
        setProfiles(list);
        setProgressAll(p);
        setDone(c);
        setEntitlement(ent);
        setStatus(list.length ? "ready" : "no-profiles");
      })
      .catch((e) => {
        console.error("[household] load failed", e);
        setStatus("signed-out");
      });
  }, [session, load, reloadKey]);

  const value = useMemo<State>(() => {
    const pid = activeId ?? "";
    const wk = (appId: string) => slugToUuid.current.get(appId);
    return {
      mode: "live",
      status,
      email: session?.user.email,
      profiles,
      active: profiles.find((p) => p.id === activeId),
      select: setActiveId,
      pinUnlocked: unlockedUntil > now,
      unlock: async (pin) => {
        const { data, error } = await db.rpc("verify_household_pin", { pin });
        if (error) return friendlyError(error);
        if (!data) return "That PIN didn’t match.";
        setUnlockedUntil(Date.now() + PIN_UNLOCK_MS);
        setNow(Date.now());
        return undefined;
      },
      lock: () => {
        if (unlockedUntil === 0) return;
        setUnlockedUntil(0);
        // End the unlock on the server too, so adult videos need the PIN again.
        void db.rpc("lock_household_pin").then(({ error }) => error && console.error("[household] lock", error.message));
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
      completed: done[pid] ?? [],
      markCompleted: (workoutId) => {
        const w = wk(workoutId);
        if (!w || !pid) return;
        setDone((all) => ({ ...all, [pid]: [...(all[pid] ?? []), workoutId] }));
        void db
          .from("completions")
          .insert({ profile_id: pid, workout_id: w })
          .then(({ error }) => error && console.error("[household] completion", error.message));
      },
      entitlement,
      signIn: async (email, password) => {
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        return error ? friendlyError(error) : undefined;
      },
      signOut: async () => {
        setActiveId(undefined);
        setUnlockedUntil(0);
        await db.auth.signOut();
      },
      reload: () => setReloadKey((k) => k + 1),
    };
  }, [db, status, session, profiles, activeId, unlockedUntil, now, progress, done, entitlement]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
