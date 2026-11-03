"use client";

import { createContext } from "react";
import type { HouseholdState } from "./household-types";

export const HouseholdCtx = createContext<HouseholdState | null>(null);
