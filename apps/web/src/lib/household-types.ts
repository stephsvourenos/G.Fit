import type { HouseholdEntitlement, Profile } from "@app/domain";

export type AccountStatus =
  | "loading"
  | "signed-out" //        live mode, nobody signed in
  | "needs-pin" //         signed in, household exists, parent PIN not set yet
  | "needs-profiles" //    PIN set, no profiles yet
  | "ready";

export interface PinResult {
  ok: boolean;
  message?: string;
}

export interface HouseholdState {
  mode: "mock" | "live";
  status: AccountStatus;
  email?: string;
  ready: boolean;
  profiles: Profile[];
  activeProfile: Profile | undefined;
  selectProfile: (id: string) => void;
  clearProfile: () => void;
  pinUnlocked: boolean;
  unlockWithPin: (pin: string) => Promise<PinResult>;
  setPin: (pin: string) => Promise<PinResult>;
  lockPin: () => void;
  addProfile: (p: Omit<Profile, "id" | "householdId">) => Promise<PinResult>;
  removeProfile: (id: string) => Promise<PinResult>;
  /** Change a profile's picture (and optionally nickname). */
  updateProfile: (id: string, patch: { avatar?: Profile["avatar"]; nickname?: string }) => Promise<PinResult>;
  progress: Record<string, number>;
  setProgress: (workoutId: string, sec: number) => void;
  favourites: string[];
  toggleFavourite: (workoutId: string) => void;
  completed: Array<{ workoutId: string; day: string }>;
  markCompleted: (workoutId: string) => void;
  /** Undefined in live mode until the household has a membership. */
  entitlement: HouseholdEntitlement | undefined;
  setSubscriptionActive?: (active: boolean) => void;
  exportData?: () => Promise<unknown>;
  /** Closes the account completely: login, household, profiles and all activity. */
  closeAccount?: () => Promise<PinResult>;
  signOut: () => Promise<void>;
}

export const PIN_UNLOCK_MS = 10 * 60 * 1000;
