"use client";

import { useEffect, useState } from "react";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { useStaffSession } from "@/lib/staff";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";
import { PriceChange } from "./PriceChange";

interface Data {
  prices: { id: string; lookup_key: string; nickname: string | null; amount_minor: number; interval: string }[];
  promo_codes: { id: string; code: string; active: boolean; times_redeemed: number; max_redemptions: number | null; expires_at: string | null; plan: string | null; label: string | null; months: number | null }[];
  founder: { settings: { founder_open: boolean; founder_closes_at: string | null; founder_limit: number | null; founder_code: string } | null; families_ever: number; families_now: number };
}
const money = (m: number) => `A$${(m / 100).toFixed(2)}`;
const PLAN_NAME: Record<string, string> = {
  gfit_family_monthly_aud_v1: "Family monthly",
  gfit_family_annual_aud_v1: "Family annual",
  gfit_family_monthly_founder_aud_v1: "Founding family (monthly)",
};

async function call<T>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  const { data, error } = await supabase().functions.invoke("pricing-admin", { body });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  try { if (ctx) return await ctx.json(); } catch { /* ignore */ }
  return { error: "Couldn’t reach the pricing service." } as T & { error?: string };
}

export function LivePricing() {
  const staff = useStaffSession();
  const isAdmin = staff.state === "ok" && staff.roles.includes("admin");
  const [d, setD] = useState<Data>();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ open: true, closes: "", limit: "", code: "FOUNDER" });
  const [n, setN] = useState({ code: "", price: "4.99", months: "6", max: "", expires: "" });

  const load = async () => {
    const r = await call<Data>({ action: "list" });
    if (r.error) return setMsg({ tone: "err", text: r.error });
    setD(r);
    const s = r.founder.settings;
    if (s) setF({ open: s.founder_open, closes: s.founder_closes_at?.slice(0, 10) ?? "", limit: s.founder_limit ? String(s.founder_limit) : "", code: s.founder_code });
  };
  useEffect(() => { if (supabaseConfigured) void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  if (!supabaseConfigured) return <p className="text-ink/60">Pricing needs the live database.</p>;

  const saveFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().from("pricing_settings").update({
      founder_open: f.open,
      founder_closes_at: f.closes ? new Date(`${f.closes}T23:59:59+11:00`).toISOString() : null,
      founder_limit: f.limit ? Number(f.limit) : null,
      founder_code: f.code.trim().toUpperCase(),
    }).eq("id", 1);
    setBusy(false);
    setMsg(error ? { tone: "err", text: friendlyError(error) } : { tone: "ok", text: "Founder offer saved." });
    load();
  };
  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await call<{ code: string }>({
      action: "create", code: n.code, price_minor: Math.round(Number(n.price) * 100), months: Number(n.months),
      max_redemptions: n.max ? Number(n.max) : undefined, expires_at: n.expires ? `${n.expires}T23:59:59+11:00` : undefined,
    });
    setBusy(false);
    setMsg(r.error ? { tone: "err", text: r.error } : { tone: "ok", text: `Promo code ${r.code} created.` });
    if (!r.error) setN({ code: "", price: "4.99", months: "6", max: "", expires: "" });
    load();
  };
  const toggle = async (id: string, active: boolean) => {
    setBusy(true);
    const r = await call({ action: "set_active", id, active });
    setBusy(false);
    if (r.error) setMsg({ tone: "err", text: r.error });
    load();
  };

  const field = "mt-1 block w-full rounded border border-ink/20 px-2 py-1.5";
  return (
    <>
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      {!d ? <p className="text-ink/60">Loading…</p> : (
        <>
          <Table head={["Plan", "Price (incl. GST)", "Stripe lookup key"]}>
            {d.prices.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-semibold">{PLAN_NAME[p.lookup_key] ?? p.nickname ?? p.lookup_key}</td>
                <td className="px-4 py-3">{money(p.amount_minor)} / {p.interval}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">{p.lookup_key}</td>
              </tr>
            ))}
          </Table>

          <h2 className="mt-8 mb-3 font-semibold">Founding families — A$9.99/month, locked in</h2>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Offer" value={d.founder.settings?.founder_open ? "Open" : "Closed"} hint={`code ${d.founder.settings?.founder_code ?? "—"}`} />
            <Kpi label="Founding families now" value={String(d.founder.families_now)} hint="active or on trial" />
            <Kpi label="Ever joined as founders" value={String(d.founder.families_ever)} hint={d.founder.settings?.founder_limit ? `limit ${d.founder.settings.founder_limit}` : "no limit"} />
            <Kpi label="Closes" value={d.founder.settings?.founder_closes_at ? new Date(d.founder.settings.founder_closes_at).toLocaleDateString("en-AU") : "No date"} />
          </div>
          <form onSubmit={saveFounder} className="grid gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-ink/5 sm:grid-cols-4">
            <fieldset disabled={!isAdmin || busy} className="contents">
              <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} />Offer open to new families</label>
              <label>Code families enter<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className={field} /></label>
              <label>Closes on (optional)<input type="date" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} className={field} /></label>
              <label>Maximum founding families (optional)<input value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={field} /></label>
              <div className="sm:col-span-4">{isAdmin ? <button className="rounded-full bg-ink px-4 py-2 font-semibold text-paper">Save founder offer</button> : <span className="text-ink/50">Only an admin can change this.</span>}</div>
            </fieldset>
          </form>
          <p className="mt-2 max-w-3xl text-xs text-ink/50">Families enter the code on the Join page (monthly plan). Closing the offer stops new founders only — existing founders keep A$9.99 for as long as their membership continues. A founder who cancels after the offer has closed can only rejoin at the normal price.</p>

          <h2 className="mt-8 mb-3 font-semibold">Promo codes (monthly plan)</h2>
          <Table head={["Code", "Offer", "Used", "Limits", "Status", ""]}>
            {d.promo_codes.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3">{c.label ? `${c.label}, then the normal price` : "—"}</td>
                <td className="px-4 py-3">{c.times_redeemed}</td>
                <td className="px-4 py-3 text-xs">{[c.max_redemptions ? `max ${c.max_redemptions}` : null, c.expires_at ? `until ${new Date(c.expires_at).toLocaleDateString("en-AU")}` : null, "new members only"].filter(Boolean).join(" · ")}</td>
                <td className="px-4 py-3">{c.active ? <Badge tone="green">on</Badge> : <Badge tone="grey">off</Badge>}</td>
                <td className="px-4 py-3">{isAdmin && <button disabled={busy} onClick={() => toggle(c.id, !c.active)} className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-ink/20">{c.active ? "Switch off" : "Switch on"}</button>}</td>
              </tr>
            ))}
          </Table>
          {isAdmin && (
            <form onSubmit={createPromo} className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-ink/5 sm:grid-cols-5">
              <div className="font-semibold sm:col-span-5">New promo code</div>
              <label>Code<input value={n.code} onChange={(e) => setN({ ...n, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="SPRING499" className={field} /></label>
              <label>Price per month (A$)<input value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} inputMode="decimal" className={field} /></label>
              <label>For how many months<input value={n.months} onChange={(e) => setN({ ...n, months: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={field} /></label>
              <label>Max uses (optional)<input value={n.max} onChange={(e) => setN({ ...n, max: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={field} /></label>
              <label>Expires (optional)<input type="date" value={n.expires} onChange={(e) => setN({ ...n, expires: e.target.value })} className={field} /></label>
              <div className="sm:col-span-5">
                <button disabled={busy || !n.code} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">Create code</button>
                <span className="ml-3 text-xs text-ink/50">After the promo months, the family pays the normal monthly price. Codes can’t be edited — switch one off and make a new one.</span>
              </div>
            </form>
          )}
          <PriceChange isAdmin={isAdmin} prices={Object.fromEntries(d.prices.map((p) => [p.lookup_key, p.amount_minor]))} />
        </>
      )}
    </>
  );
}
