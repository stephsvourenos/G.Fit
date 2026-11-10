"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Entry { id: string; creator_id: string; kind: string; amount_minor: number; earning_month: string; run_status: string; contract_ref: string; memo: string | null; source_refs: string[]; reverses_entry_id: string | null; created_at: string }
interface Paid { entry_id: string; batch_id: string; payout_batches: { status: string } | null }

async function load() {
  const db = supabase();
  const [e, p, c] = await Promise.all([
    db.from("ledger_entries").select("*").eq("run_status", "final").order("created_at", { ascending: false }).limit(5000),
    db.from("payout_item_entries").select("entry_id, batch_id, payout_batches(status)"),
    db.from("creators").select("id, display_name"),
  ]);
  const err = e.error ?? p.error ?? c.error;
  if (err) return { error: friendlyError(err) };
  return { entries: e.data as Entry[], paid: p.data as unknown as Paid[], names: new Map((c.data ?? []).map((x) => [x.id as string, x.display_name as string])) };
}

/** The creator liability ledger from the real (final, append-only) ledger entries. */
export function LiveLedger({ demo }: { demo: ReactNode }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof load>>>();
  const [creator, setCreator] = useState<string>("");
  useEffect(() => { if (supabaseConfigured) void load().then(setD); }, []);
  if (!supabaseConfigured) return <>{demo}</>;
  if (!d) return <p className="text-ink/60">Loading…</p>;
  if ("error" in d) return <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{d.error}</p>;

  const state = new Map(d.paid.map((p) => [p.entry_id, p.payout_batches?.status ?? "draft"]));
  const per = new Map<string, { royalties: number; referrals: number; adjustments: number; paid: number; scheduled: number }>();
  for (const e of d.entries) {
    const b = per.get(e.creator_id) ?? { royalties: 0, referrals: 0, adjustments: 0, paid: 0, scheduled: 0 };
    if (e.kind === "royalty") b.royalties += e.amount_minor;
    else if (e.kind === "referral") b.referrals += e.amount_minor;
    else b.adjustments += e.amount_minor;
    const s = state.get(e.id);
    if (s === "confirmed") b.paid += e.amount_minor;
    else if (s && !["cancelled", "failed"].includes(s)) b.scheduled += e.amount_minor;
    per.set(e.creator_id, b);
  }
  const rows = [...per.entries()].map(([id, b]) => ({ id, name: d.names.get(id) ?? id.slice(0, 8), ...b, total: b.royalties + b.referrals + b.adjustments }))
    .sort((a, b) => b.total - a.total);
  const sum = (k: "royalties" | "referrals" | "adjustments" | "paid" | "scheduled" | "total") => rows.reduce((a, r) => a + r[k], 0);
  const shown = d.entries.filter((e) => !creator || e.creator_id === creator).slice(0, 50);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Royalties (final)" value={formatMoney(sum("royalties"))} />
        <Kpi label="Referral commission" value={formatMoney(sum("referrals"))} />
        <Kpi label="Adjustments" value={formatMoney(sum("adjustments"))} hint="refund reversals" />
        <Kpi label="Paid" value={formatMoney(sum("paid"))} hint={`${formatMoney(sum("scheduled"))} in batches`} />
        <Kpi label="Owed to creators" value={formatMoney(sum("total") - sum("paid") - sum("scheduled"))} hint="earned, not yet in a batch" />
      </div>
      <p className="mt-2 text-xs text-ink/50">Finalised months only. The current month’s figures are a preview in Monthly royalty run until it’s finalised.</p>

      <h2 className="mt-8 mb-3 font-semibold">Balances by creator</h2>
      {rows.length === 0 ? <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No finalised earnings yet.</p> : (
        <Table head={["Creator", "Royalties", "Referrals", "Adjustments", "Earned", "In payout batches", "Paid", "Owed"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-semibold">{r.name}</td>
              <td className="px-4 py-3">{formatMoney(r.royalties)}</td>
              <td className="px-4 py-3">{formatMoney(r.referrals)}</td>
              <td className="px-4 py-3">{formatMoney(r.adjustments)}</td>
              <td className="px-4 py-3">{formatMoney(r.total)}</td>
              <td className="px-4 py-3">{formatMoney(r.scheduled)}</td>
              <td className="px-4 py-3">{formatMoney(r.paid)}</td>
              <td className="px-4 py-3 font-semibold">{formatMoney(r.total - r.paid - r.scheduled)}</td>
            </tr>
          ))}
        </Table>
      )}

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Entries (newest first)</h2>
        <select value={creator} onChange={(e) => setCreator(e.target.value)} className="rounded border border-ink/20 px-2 py-1 text-sm">
          <option value="">All creators</option>
          {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      {shown.length > 0 && (
        <Table head={["Month", "Creator", "Type", "Amount", "Contract", "Paid?", "Memo"]}>
          {shown.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3">{e.earning_month}</td>
              <td className="px-4 py-3">{d.names.get(e.creator_id) ?? "—"}</td>
              <td className="px-4 py-3"><Badge tone={e.kind === "referral" ? "blue" : e.kind === "adjustment" ? "red" : "green"}>{e.kind}</Badge></td>
              <td className={`px-4 py-3 ${e.amount_minor < 0 ? "text-coral" : ""}`}>{formatMoney(e.amount_minor)}</td>
              <td className="px-4 py-3 text-xs">{e.contract_ref}</td>
              <td className="px-4 py-3 text-xs">{state.get(e.id) ?? "not yet"}</td>
              <td className="px-4 py-3 text-xs">{e.memo}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-ink/50">Append-only: entries are never edited or deleted. Refunds and corrections are new, linked adjusting entries.</p>
    </>
  );
}
