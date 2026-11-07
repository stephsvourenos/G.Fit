import { supabase } from "./supabase";

export interface StatementRow {
  creator_id: string;
  opening_balance_minor: number;
  royalties_minor: number;
  referrals_minor: number;
  adjustments_minor: number;
  paid_out_minor: number;
  closing_balance_minor: number;
  payable_minor: number;
  carried_forward_minor: number;
  next_pay_date: string | null;
  payable_status?: string;
}

/** Calls the month-end server function (admin/finance only). */
export async function monthEnd<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  const { data, error } = await supabase().functions.invoke("month-end", { body });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  try {
    if (ctx) return await ctx.json();
  } catch {
    /* fall through */
  }
  return { error: "Couldn’t reach the month-end service." } as T & { error?: string };
}

/** Creator id → display name (staff can read all creators). */
export async function creatorNames(): Promise<Record<string, string>> {
  const { data } = await supabase().from("creators").select("id, display_name");
  return Object.fromEntries((data ?? []).map((c) => [c.id, c.display_name]));
}

/** Previous calendar month in Sydney, e.g. "2026-10". */
export function previousMonth(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
