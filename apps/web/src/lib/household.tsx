"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { HouseholdEntitlement, Profile } from "@app/domain";
import { DEMO_PIN, demoHouseholdId, demoProfiles, demoProgress } from "@app/mock-data";
import { load, save } from "./storage";

/**
 * PROTOTYPE household state. In Phase 1 this is replaced by Supabase Auth +
 * Row-Level-Security tables; the PIN is then verified server-side against a
 * salted hash and never stored in the browser.
 */
interface HouseholdState {
  ready: boolean;
  profiles: Profile[];
  activeProfile: Profile | undefined;
  selectProfile: (id: string) => void;
  clearProfile: () => void;
  pinUnlocked: boolean;
  unlockWithPin: (pin: string) => boolean;
  lockPin: () => void;
  addProfile: (p: Omit<Profile, "id" | "householdId">) => void;
  removeProfile: (id: string) => void;
  progress: Record<string, number>;
  setProgress: (workoutId: string, sec: number) => void;
  favourites: string[];
  toggleFavourite: (workoutId: string) => void;
  completed: Array<{ workoutId: string; day: string }>;
  markCompleted: (workoutId: string) => void;
  entitlement: HouseholdEntitlement;
  setSubscriptionActive: (active: boolean) => void;
}

const Ctx = createContext<HouseholdState | null>(null);

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}
const PIN_UNLOCK_MS = 10 * 60 * 1000;

function initialEntitlement(active: boolean): HouseholdEntitlement {
  return {
    householdId: demoHouseholdId,
    provider: "mock",
    providerSubscriptionId: "sub_mock_demo",
    status: active ? "active" : "canceled",
    currentPeriodEnd: active ? "2099-01-01T00:00:00Z" : "2026-01-01T00:00:00Z",
    graceDays: 3,
  };
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(demoProfiles);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [unlockedUntil, setUnlockedUntil] = useState(0);
  const [progressByProfile, setProgressByProfile] = useState<Record<string, Record<string, number>>>(demoProgress);
  const [favByProfile, setFavByProfile] = useState<Record<string, string[]>>({});
  const [doneByProfile, setDoneByProfile] = useState<Record<string, Array<{ workoutId: string; day: string }>>>({});
  const [subActive, setSubActive] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Hydrate from browser storage after mount (not during render) so the
  // server-rendered HTML and the first client render always match.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setProfiles(load("pf.profiles", demoProfiles));
    setActiveId(load<string | undefined>("pf.active", undefined));
    setUnlockedUntil(load("pf.unlockedUntil", 0));
    setProgressByProfile(load("pf.progress", demoProgress));
    setFavByProfile(load("pf.favourites", {}));
    setDoneByProfile(load("pf.completed", {}));
    setSubActive(load("pf.subActive", true));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    save("pf.profiles", profiles);
    save("pf.active", activeId);
    save("pf.unlockedUntil", unlockedUntil);
    save("pf.progress", progressByProfile);
    save("pf.favourites", favByProfile);
    save("pf.completed", doneByProfile);
    save("pf.subActive", subActive);
  }, [ready, profiles, activeId, unlockedUntil, progressByProfile, favByProfile, doneByProfile, subActive]);

  const pinUnlocked = unlockedUntil > now;
  const activeProfile = profiles.find((p) => p.id === activeId);

  const unlockWithPin = useCallback((pin: string) => {
    if (pin !== DEMO_PIN) return false;
    setUnlockedUntil(Date.now() + PIN_UNLOCK_MS);
    setNow(Date.now());
    return true;
  }, []);

  const value = useMemo<HouseholdState>(() => {
    const pid = activeProfile?.id ?? "";
    return {
      ready,
      profiles,
      activeProfile,
      selectProfile: (id) => setActiveId(id),
      clearProfile: () => setActiveId(undefined),
      pinUnlocked,
      unlockWithPin,
      lockPin: () => setUnlockedUntil(0),
      addProfile: (p) =>
        setProfiles((list) => [...list, { ...p, id: `pr-${Math.random().toString(36).slice(2, 8)}`, householdId: demoHouseholdId }]),
      removeProfile: (id) => {
        setProfiles((list) => list.filter((p) => p.id !== id));
        // Deleting a child profile deletes its activity too.
        setProgressByProfile((all) => without(all, id));
        setFavByProfile((all) => without(all, id));
        setDoneByProfile((all) => without(all, id));
        if (activeId === id) setActiveId(undefined);
      },
      progress: progressByProfile[pid] ?? {},
      setProgress: (workoutId, sec) =>
        setProgressByProfile((all) => ({ ...all, [pid]: { ...(all[pid] ?? {}), [workoutId]: sec } })),
      favourites: favByProfile[pid] ?? [],
      toggleFavourite: (workoutId) =>
        setFavByProfile((all) => {
          const cur = all[pid] ?? [];
          return { ...all, [pid]: cur.includes(workoutId) ? cur.filter((x) => x !== workoutId) : [...cur, workoutId] };
        }),
      completed: doneByProfile[pid] ?? [],
      markCompleted: (workoutId) =>
        setDoneByProfile((all) => ({
          ...all,
          [pid]: [...(all[pid] ?? []), { workoutId, day: new Date().toISOString().slice(0, 10) }],
        })),
      entitlement: initialEntitlement(subActive),
      setSubscriptionActive: setSubActive,
    };
  }, [ready, profiles, activeProfile, pinUnlocked, unlockWithPin, progressByProfile, favByProfile, doneByProfile, subActive, activeId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold(): HouseholdState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHousehold must be used inside HouseholdProvider");
  return v;
}
