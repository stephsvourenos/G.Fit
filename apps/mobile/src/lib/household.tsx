import { createContext, useContext, useMemo, useState } from "react";
import type { HouseholdEntitlement, Profile } from "@app/domain";
import { DEMO_PIN, demoHouseholdId, demoProfiles, demoProgress } from "@app/mock-data";

/**
 * PROTOTYPE: in-memory household state. Phase 1 replaces this with Supabase
 * Auth (household sign-in) and server-verified PIN checks. The app is
 * SIGN-IN ONLY: no purchase screens until the app-store billing decision is made.
 */
interface State {
  profiles: Profile[];
  active?: Profile;
  select: (id: string) => void;
  pinUnlocked: boolean;
  unlock: (pin: string) => boolean;
  lock: () => void;
  progress: Record<string, number>;
  setProgress: (workoutId: string, sec: number) => void;
  completed: string[];
  markCompleted: (workoutId: string) => void;
  entitlement: HouseholdEntitlement;
}

const Ctx = createContext<State | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>();
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [progress, setProgressAll] = useState<Record<string, Record<string, number>>>(demoProgress);
  const [completed, setCompleted] = useState<Record<string, string[]>>({});

  const value = useMemo<State>(() => {
    const active = demoProfiles.find((p) => p.id === activeId);
    const pid = active?.id ?? "";
    return {
      profiles: demoProfiles,
      active,
      select: setActiveId,
      pinUnlocked,
      unlock: (pin) => {
        const ok = pin === DEMO_PIN;
        if (ok) setPinUnlocked(true);
        return ok;
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
    };
  }, [activeId, pinUnlocked, progress, completed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("HouseholdProvider missing");
  return v;
}
