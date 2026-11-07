"use client";

import { useEffect, useState } from "react";
import { downloadText, payoutFile } from "@/lib/finance";
import { useStaffSession } from "@/lib/staff";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Settings {
  bank_code: string | null; de_user_name: string | null; de_user_id: string | null; bsb: string | null;
  account_number: string | null; account_title: string | null; remitter_name: string | null;
  self_balancing: boolean; balancing_debit_code: string; video_cost_per_1000_min_minor: number; updated_at: string;
}
const BANKS = [
  ["CBA", "Commonwealth Bank"], ["NAB", "NAB"], ["WBC", "Westpac"], ["ANZ", "ANZ"], ["BQL", "Bank of Queensland"],
  ["BEN", "Bendigo Bank"], ["STG", "St.George"], ["MQG", "Macquarie"], ["SUN", "Suncorp"],
];

/**
 * Your business's direct-entry details (from your bank) used to build the bank payment file.
 * These are not secrets — they appear on every payment file — but only an admin can change them.
 */
export function FinanceSettings() {
  const staff = useStaffSession();
  const isAdmin = staff.state === "ok" && staff.roles.includes("admin");
  const [s, setS] = useState<Settings>();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [videoCost, setVideoCost] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase().from("finance_settings").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error) setMsg({ tone: "err", text: friendlyError(error) });
      else { setS(data as Settings); setVideoCost(((data?.video_cost_per_1000_min_minor ?? 0) / 100).toFixed(2)); }
    });
  }, []);
  if (!supabaseConfigured || !s) return null;

  const set = (k: keyof Settings, v: unknown) => setS({ ...s, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const bsb = (s.bsb ?? "").replace(/\D/g, "");
    const { error } = await supabase().from("finance_settings").update({
      bank_code: s.bank_code || null,
      de_user_name: s.de_user_name?.trim() || null,
      de_user_id: s.de_user_id?.trim() || null,
      bsb: bsb ? `${bsb.slice(0, 3)}-${bsb.slice(3)}` : null,
      account_number: s.account_number?.replace(/\s/g, "") || null,
      account_title: s.account_title?.trim() || null,
      remitter_name: s.remitter_name?.trim() || null,
      self_balancing: s.self_balancing,
      video_cost_per_1000_min_minor: Math.max(0, Math.round(Number(videoCost || 0) * 100)) || 0,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    setMsg(error ? { tone: "err", text: friendlyError(error) } : { tone: "ok", text: "Saved." });
  };
  const sample = async () => {
    const r = await payoutFile<{ filename: string; text: string }>({ action: "sample" });
    if (r.error) return setMsg({ tone: "err", text: `${r.error}${(r as { settings_errors?: string[] }).settings_errors ? ": " + (r as { settings_errors?: string[] }).settings_errors!.join("; ") : ""}` });
    downloadText(r.filename, r.text);
    setMsg({ tone: "ok", text: `Test file ${r.filename} downloaded — two made-up payees, $1.00 each. Run it through your bank’s file checker (don’t submit it for payment).` });
  };

  const field = "mt-1 block w-full rounded border border-ink/20 px-2 py-1.5";
  return (
    <section className="mb-6 rounded-xl bg-white p-5 ring-1 ring-ink/5">
      <h2 className="font-semibold">Bank payment file (paying creators)</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink/60">
        From your business bank once direct entry / bulk payments is switched on for your account. These details are printed in every payment file, so they
        aren’t secret — but never put your online-banking password or security codes here.
      </p>
      {msg && <p role="alert" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      <form onSubmit={save} className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <fieldset disabled={!isAdmin || busy} className="contents">
          <label>Your bank
            <select value={s.bank_code ?? ""} onChange={(e) => set("bank_code", e.target.value)} className={field}>
              <option value="">Choose…</option>
              {BANKS.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
            </select>
          </label>
          <label>Direct Entry User ID (6 digits, from your bank)<input value={s.de_user_id ?? ""} onChange={(e) => set("de_user_id", e.target.value)} inputMode="numeric" maxLength={6} className={field} /></label>
          <label>Direct entry user name (as registered with the bank)<input value={s.de_user_name ?? ""} onChange={(e) => set("de_user_name", e.target.value)} maxLength={26} className={field} /></label>
          <label>Name on creators’ statements (max 16)<input value={s.remitter_name ?? ""} onChange={(e) => set("remitter_name", e.target.value)} maxLength={16} placeholder="G FIT" className={field} /></label>
          <label>Paying account BSB<input value={s.bsb ?? ""} onChange={(e) => set("bsb", e.target.value)} placeholder="000-000" className={field} /></label>
          <label>Paying account number<input value={s.account_number ?? ""} onChange={(e) => set("account_number", e.target.value)} inputMode="numeric" className={field} /></label>
          <label>Paying account name<input value={s.account_title ?? ""} onChange={(e) => set("account_title", e.target.value)} maxLength={32} className={field} /></label>
          <label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={s.self_balancing} onChange={(e) => set("self_balancing", e.target.checked)} />My bank wants a balancing (debit) line in the file</label>
          <label>Video delivery cost per 1,000 minutes (A$, for the margin report)
            <input value={videoCost} onChange={(e) => setVideoCost(e.target.value)} inputMode="decimal" className={field} />
          </label>
        </fieldset>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          {isAdmin && <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">Save</button>}
          <button type="button" onClick={sample} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Download test file</button>
          {!isAdmin && <span className="text-xs text-ink/50">Only an admin can change these.</span>}
        </div>
      </form>
    </section>
  );
}
