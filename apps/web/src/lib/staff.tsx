"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

export type StaffRole = "admin" | "content_editor" | "finance" | "support";

export interface StaffSession {
  state: "loading" | "signed-out" | "no-access" | "ok";
  email?: string;
  roles: StaffRole[];
  creatorIds: string[];
}

/**
 * Who is signed in and what they're allowed to do. The database decides what
 * each role can actually read or change; this only drives what the UI shows.
 * In mock mode (no Supabase keys) everyone is treated as a demo admin.
 */
export function useStaffSession(): StaffSession {
  const [s, setS] = useState<StaffSession>(
    supabaseConfigured ? { state: "loading", roles: [], creatorIds: [] } : { state: "ok", email: "demo", roles: ["admin"], creatorIds: [] },
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    const db = supabase();
    let cancelled = false;
    async function resolve(session: Session | null) {
      if (!session) return !cancelled && setS({ state: "signed-out", roles: [], creatorIds: [] });
      const [roles, links] = await Promise.all([
        db.from("staff_members").select("role").eq("user_id", session.user.id),
        db.from("creator_users").select("creator_id").eq("user_id", session.user.id),
      ]);
      if (cancelled) return;
      const r = (roles.data ?? []).map((x) => x.role as StaffRole);
      const c = (links.data ?? []).map((x) => x.creator_id as string);
      setS({ state: r.length || c.length ? "ok" : "no-access", email: session.user.email, roles: r, creatorIds: c });
    }
    db.auth.getSession().then(({ data }) => resolve(data.session));
    const { data } = db.auth.onAuthStateChange((_e, session) => void resolve(session));
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return s;
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  content_editor: "Content editor",
  finance: "Finance",
  support: "Support",
};
