"use client";

import { useContext } from "react";
import { HouseholdCtx } from "./household-context";
import { supabaseConfigured } from "./supabase";
import { MockHouseholdProvider } from "./household-mock";
import { LiveHouseholdProvider } from "./household-live";
import type { HouseholdState } from "./household-types";

export type { HouseholdState } from "./household-types";

/** Real accounts when Supabase keys are configured; sample household otherwise. */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  return supabaseConfigured ? (
    <LiveHouseholdProvider>{children}</LiveHouseholdProvider>
  ) : (
    <MockHouseholdProvider>{children}</MockHouseholdProvider>
  );
}

export function useHousehold(): HouseholdState {
  const v = useContext(HouseholdCtx);
  if (!v) throw new Error("useHousehold must be used inside HouseholdProvider");
  return v;
}
