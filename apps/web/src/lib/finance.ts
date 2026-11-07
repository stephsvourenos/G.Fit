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

/** Calls a finance server function (admin/finance only) and always returns JSON, with `error` on failure. */
async function callFn<T>(name: string, body: Record<string, unknown>): Promise<T & { error?: string }> {
  const { data, error } = await supabase().functions.invoke(name, { body });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  try {
    if (ctx) return await ctx.json();
  } catch {
    /* fall through */
  }
  return { error: `Couldn’t reach the ${name} service.` } as T & { error?: string };
}

/** Month-end: preview / final / verify / payables / create-payout-batch. */
export const monthEnd = <T = Record<string, unknown>>(body: Record<string, unknown>) => callFn<T>("month-end", body);

/** Bank payment files: check / sample / generate / download / reconcile. */
export const payoutFile = <T = Record<string, unknown>>(body: Record<string, unknown>) => callFn<T>("payout-file", body);

/** Save text as a file in the browser (e.g. an .aba bank file). Keeps CRLF line endings exactly. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
