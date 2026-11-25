"use client";

// Creator Acquisition CRM: data access for the admin screens. Everything goes through the signed-in staff member's
// session; the database's row rules and functions decide what they can see and do.

import { useCallback, useEffect, useState } from "react";
import type { InflateRaw } from "@app/domain/crm";
import { supabase, supabaseConfigured } from "./supabase";

export interface Stage {
  key: string;
  label: string;
  position: number;
  kind: "stage" | "outcome";
  system_event: boolean;
  queue: "new" | "follow_up" | null;
  active: boolean;
  built_in: boolean;
}

export interface CrmSettings {
  targets: Record<string, number | string>;
  queue: Record<string, number>;
  scoring: { weights: Record<string, number>; tiers: Array<{ tier: string; min: number }> };
  categories: Array<{ name: string; target: number }>;
  founder_name: string | null;
  application_url: string | null;
  updated_at: string;
}

export interface StaffUser {
  user_id: string;
  email: string;
  roles: string[];
}

/** The summary of a prospect returned by the queue and task functions. */
export interface Card {
  id: string;
  ref: number;
  creator_name: string;
  business_name: string | null;
  country: string | null;
  primary_category: string | null;
  allocation_category: string | null;
  primary_platform: string | null;
  followers: number | null;
  fit_score: number | null;
  fit_tier: string | null;
  confidence_level: string | null;
  stage: string;
  last_contact_at: string | null;
  assigned_to: string | null;
  channel: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  contact_form_url: string | null;
  public_business_email: string | null;
  outreach_permission_status: string;
  personalised_initial_dm: string | null;
  personalised_initial_email: string | null;
  specific_personalisation_detail: string | null;
  recommended_pitch_angle: string | null;
  why_gfit_is_relevant: string | null;
  outbound_count: number;
  last_inbound_at: string | null;
  full_length_workouts_available: boolean | null;
  do_not_contact: boolean;
  unavailable_channels?: string[];
}

export interface Task {
  id: string;
  prospect_id: string | null;
  kind: "follow_up" | "reply" | "custom";
  title: string;
  follow_up_number: number | null;
  due_on: string;
  status: string;
  snoozed_until: string | null;
}

export interface Template {
  id: string;
  name: string;
  channel: "dm" | "email" | "contact_form" | "linkedin";
  purpose: string;
  categories: string[];
  creator_types: string[];
  stage: string | null;
  objection: string | null;
  follow_up_number: number | null;
  partnership_type: string | null;
  commercial: boolean;
  active: boolean;
  current_version: number;
  subject: string | null;
  body: string;
}

export const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  email: "Email",
  contact_form: "Contact form",
  phone: "Phone",
  website: "Website",
};

export const PURPOSE_LABEL: Record<string, string> = {
  initial: "First message",
  follow_up: "Follow-up",
  interested_response: "Reply to interested creator",
  application_invitation: "Application invitation",
  agreement_reminder: "Agreement reminder",
  content_reminder: "Content reminder",
  nomination_request: "Nomination request",
  partnership: "Partnership",
  onboarding: "Onboarding",
  other: "Other",
};

export const PERMISSION_LABEL: Record<string, string> = {
  unknown: "Not yet checked",
  published_business_contact: "Published for business enquiries",
  express_consent: "Creator agreed to hear from us",
  withdrawn: "Asked not to be contacted",
};

export function db() {
  return supabase();
}

/** Turns a database error into a message a person can act on. */
export function crmError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Only admins and recruiters/i.test(m)) return "Your login doesn't have access to the creator CRM. Ask an admin to give you the Recruiter role.";
  if (/row-level security|permission denied/i.test(m)) return "Your login isn't allowed to do that. Ask an admin.";
  if (/fetch|network/i.test(m)) return "We couldn't reach the server. Check your connection and try again.";
  return m.replace(/^.*?ERROR:\s*/, "");
}

// ---------- shared lookups (cached for the session) ----------
let stagesCache: Promise<Stage[]> | null = null;
let staffCache: Promise<StaffUser[]> | null = null;

export function loadStages(force = false): Promise<Stage[]> {
  if (!stagesCache || force) {
    stagesCache = Promise.resolve(db().from("crm_stages").select("*").order("position")).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as Stage[];
    });
    stagesCache.catch(() => (stagesCache = null));
  }
  return stagesCache;
}

export function loadStaff(): Promise<StaffUser[]> {
  if (!staffCache) {
    staffCache = Promise.resolve(db().rpc("crm_staff_list")).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as StaffUser[];
    });
    staffCache.catch(() => (staffCache = null));
  }
  return staffCache;
}

export async function loadSettings(): Promise<CrmSettings> {
  const { data, error } = await db().from("crm_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as CrmSettings;
}

export async function loadTemplates(): Promise<Template[]> {
  const { data, error } = await db().from("crm_templates").select("*, crm_template_versions(version, subject, body)").order("name");
  if (error) throw error;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((t: any) => {
    const v = (t.crm_template_versions ?? []).find((x: any) => x.version === t.current_version) ?? {};
    const { crm_template_versions: _omit, ...rest } = t;
    void _omit;
    return { ...rest, subject: v.subject ?? null, body: v.body ?? "" } as Template;
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Small hook for "load once, show a spinner, show an error, reload on demand". */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let live = true;
    fn()
      .then((d) => live && setState({ key, data: d }))
      .catch((e) => live && setState((s) => ({ key, data: s.data, error: crmError(e) })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setData = useCallback((d: T) => setState((s) => ({ ...s, data: d })), []);
  return { data: state.data, error: state.error, loading: supabaseConfigured && state.key !== key, reload, setData };
}

// ---------- files ----------
/** Browser DEFLATE decompression for reading .xlsx files (no library needed). */
export const inflateRaw: InflateRaw = async (bytes) => {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

export function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}), timeZone: iso.length === 10 ? undefined : "Australia/Sydney" });
}

export function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "unknown";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Profile links we can open for a prospect, best first. Only http(s) links are ever stored. */
export function profileLinks(p: Partial<Card>): Array<{ channel: string; url: string }> {
  const out: Array<{ channel: string; url: string }> = [];
  const add = (channel: string, url: string | null | undefined) => url && /^https?:\/\//i.test(url) && out.push({ channel, url });
  add("instagram", p.instagram_url);
  add("tiktok", p.tiktok_url);
  add("youtube", p.youtube_url);
  add("facebook", p.facebook_url);
  add("linkedin", p.linkedin_url);
  add("website", p.website_url);
  add("contact_form", p.contact_form_url);
  return out;
}

export function channelUrl(p: Partial<Card>, channel: string | null): string | null {
  if (!channel) return null;
  const m: Record<string, string | null | undefined> = {
    instagram: p.instagram_url, tiktok: p.tiktok_url, youtube: p.youtube_url, facebook: p.facebook_url,
    linkedin: p.linkedin_url, website: p.website_url, contact_form: p.contact_form_url,
  };
  const u = m[channel];
  return u && /^https?:\/\//i.test(u) ? u : null;
}
