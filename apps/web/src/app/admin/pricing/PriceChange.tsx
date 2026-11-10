"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/AdminShell";
import { friendlyError, supabase } from "@/lib/supabase";

interface Change { id: number; plan_key: string; old_price_minor: number; new_price_minor: number; effective_date: string; notified: number; announced_at: string }
const money = (m: number) => `A$${(m / 100).toFixed(2)}`;
const PLANS: Array<[string, string, number]> = [
  ["gfit_family_monthly_aud_v1", "Family monthly", 1499],
  ["gfit_family_annual_aud_v1", "Family annual", 14999],
];

/**
 * Tell families about a price rise at least 30 days ahead (email to everyone on that plan).
 * Founding families are never included. Switching the Stripe price on the day is done separately.
 */
export function PriceChange({ isAdmin, prices }: { isAdmin: boolean; prices: Record<string, number> }) {
  const [rows, setRows] = useState<Change[]>();
  const [f, setF] = useState({ plan: PLANS[0]![0], price: "", effective: "", reason: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const load = () => supabase().from("price_changes").select("*").order("announced_at", { ascending: false }).then(({ data }) => setRows((data ?? []) as Change[]));
  const [earliest] = useState(() => new Date(Date.now() + 31 * 86400_000).toISOString().slice(0, 10));
  useEffect(() => { void load(); }, []);
  const current = prices[f.plan] ?? PLANS.find((p) => p[0] === f.plan)![2];

  const announce = async () => {
    setBusy(true);
    const { data, error } = await supabase().rpc("admin_announce_price_change", {
      p_plan_key: f.plan, p_old_minor: current, p_new_minor: Math.round(Number(f.price) * 100), p_effective: f.effective, p_reason: f.reason || null,
    });
    setBusy(false);
    setConfirm(false);
    setMsg(error ? { tone: "err", text: friendlyError(error) } : { tone: "ok", text: `Announced. ${data} famil${data === 1 ? "y" : "ies"} will be emailed.` });
    if (!error) { setF({ ...f, price: "", effective: "", reason: "" }); void load(); }
  };

  const field = "mt-1 block w-full rounded border border-ink/20 px-2 py-1.5";
  return (
    <>
      <h2 className="mt-8 mb-3 font-semibold">Price changes for existing members</h2>
      {msg && <p role="alert" className={`mb-3 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      {isAdmin && (
        <div className="grid gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-ink/5 sm:grid-cols-4">
          <label>Plan
            <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} className={field}>
              {PLANS.map(([k, n]) => <option key={k} value={k}>{n} (now {money(prices[k] ?? PLANS.find((p) => p[0] === k)![2])})</option>)}
            </select>
          </label>
          <label>New price (A$, incl. GST)<input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className={field} /></label>
          <label>From (at least 30 days away)<input type="date" min={earliest} value={f.effective} onChange={(e) => setF({ ...f, effective: e.target.value })} className={field} /></label>
          <label>Reason (optional, in the email)<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={200} className={field} /></label>
          <div className="sm:col-span-4">
            {!confirm ? (
              <button disabled={!f.price || !f.effective} onClick={() => setConfirm(true)} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">Announce…</button>
            ) : (
              <span className="flex flex-wrap items-center gap-3">
                <b>Email every family on this plan that the price goes from {money(current)} to {money(Math.round(Number(f.price) * 100))} from {f.effective}?</b>
                <button disabled={busy} onClick={announce} className="rounded-full bg-coral px-4 py-2 font-semibold text-white">Yes, announce</button>
                <button onClick={() => setConfirm(false)} className="underline">Cancel</button>
              </span>
            )}
            <p className="mt-2 text-xs text-ink/50">Founding families are never included. On the day, the Stripe price switch is a separate step (ask for it then). New members pay whatever price is live when they join.</p>
          </div>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="mt-3">
          <Table head={["Announced", "Plan", "Change", "From", "Families emailed"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs">{new Date(r.announced_at).toLocaleDateString("en-AU")}</td>
                <td className="px-4 py-3">{PLANS.find((p) => p[0] === r.plan_key)?.[1] ?? r.plan_key}</td>
                <td className="px-4 py-3">{money(r.old_price_minor)} → {money(r.new_price_minor)}</td>
                <td className="px-4 py-3">{r.effective_date}</td>
                <td className="px-4 py-3">{r.notified}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </>
  );
}
