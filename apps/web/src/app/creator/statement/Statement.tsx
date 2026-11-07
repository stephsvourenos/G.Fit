"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@app/config";
import { formatMoney } from "@app/domain";
import { useStaffSession } from "@/lib/staff";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Data {
  creator: { display_name: string; legal_name: string | null; payee_name: string | null; guardian_managed: boolean; abn: string | null; gst_registered: boolean };
  st: { month: string; run_id: string; opening_balance_minor: number; royalties_minor: number; referrals_minor: number; adjustments_minor: number; paid_out_minor: number; closing_balance_minor: number; payable_minor: number; carried_forward_minor: number; next_pay_date: string | null; created_at: string };
  entries: { id: string; kind: string; amount_minor: number; memo: string | null; contract_ref: string; source_refs: string[] }[];
}

/**
 * Printable monthly statement (use the browser's Print → Save as PDF).
 * Creators see their own; finance/admin can open any creator's with ?creator=<id>.
 * Statements are permanent once the month is final.
 */
export function Statement() {
  const q = useSearchParams();
  const month = q.get("month") ?? "";
  const s = useStaffSession();
  const creatorId = q.get("creator") ?? s.creatorIds[0];
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!supabaseConfigured || !creatorId || !/^\d{4}-\d{2}$/.test(month)) return;
    const db = supabase();
    Promise.all([
      db.from("creators").select("display_name, legal_name, payee_name, guardian_managed, abn, gst_registered").eq("id", creatorId).single(),
      db.from("creator_statements").select("*").eq("creator_id", creatorId).eq("month", month).maybeSingle(),
      db.from("ledger_entries").select("id, kind, amount_minor, memo, contract_ref, source_refs").eq("creator_id", creatorId).eq("earning_month", month).eq("run_status", "final").order("kind").order("id"),
    ])
      .then(([c, st, e]) => {
        if (c.error) throw c.error;
        if (!st.data) throw new Error("No final statement for this month yet.");
        setData({ creator: c.data, st: st.data, entries: e.data ?? [] } as Data);
      })
      .catch((err) => setError(err instanceof Error && !("code" in err) ? err.message : friendlyError(err)));
  }, [creatorId, month]);

  if (s.state === "loading") return <main className="p-8 text-ink/60">Checking your access…</main>;
  if (error) return <main className="p-8"><p role="alert" className="text-[#b8361a]">{error}</p><Link href="/creator/" className="mt-4 inline-block underline">Back</Link></main>;
  if (!data) return <main className="p-8 text-ink/60">Loading statement…</main>;
  const { creator, st, entries } = data;
  const row = (label: string, v: number, strong = false) => (
    <tr className={strong ? "font-semibold" : ""}><td className="py-1.5">{label}</td><td className="py-1.5 text-right tabular-nums">{formatMoney(v)}</td></tr>
  );
  const kindLabel: Record<string, string> = { royalty: "Content royalty", referral: "Referral commission", adjustment: "Adjustment" };

  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-8 text-ink print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/creator/" className="text-sm underline">← Back to portal</Link>
        <button onClick={() => window.print()} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">Print / save as PDF</button>
      </div>
      <header className="flex items-start justify-between border-b border-ink/15 pb-4">
        <div>
          <div className="font-display text-2xl">{brand.name}</div>
          <div className="text-sm text-ink/60">Creator statement</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">{new Date(`${st.month}-01T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</div>
          <div className="text-ink/60">Ref {st.run_id}</div>
          <div className="text-ink/60">Issued {new Date(st.created_at).toLocaleDateString("en-AU")}</div>
        </div>
      </header>
      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/50">Creator</div>
          <div className="font-semibold">{creator.display_name}</div>
          {creator.legal_name && <div>{creator.legal_name}</div>}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/50">Paid to</div>
          <div className="font-semibold">{creator.payee_name ?? creator.legal_name ?? creator.display_name}</div>
          {creator.guardian_managed && <div className="text-ink/60">Parent/guardian (creator is under 18)</div>}
          <div className="text-ink/60">ABN {creator.abn ?? "not provided"} · {creator.gst_registered ? "GST registered" : "not registered for GST"}</div>
        </div>
      </section>
      <table className="mt-6 w-full text-sm">
        <tbody className="divide-y divide-ink/10">
          {row("Opening balance", st.opening_balance_minor)}
          {row("Content royalties", st.royalties_minor)}
          {row("Referral commission", st.referrals_minor)}
          {row("Adjustments (e.g. refunds)", st.adjustments_minor)}
          {row("Paid to you this month", -st.paid_out_minor)}
          {row("Closing balance", st.closing_balance_minor, true)}
        </tbody>
      </table>
      <p className="mt-3 rounded-lg bg-paper-2 p-3 text-sm">
        {st.payable_minor > 0
          ? `${formatMoney(st.payable_minor)} will be paid on ${st.next_pay_date}.`
          : `${formatMoney(st.carried_forward_minor)} is carried forward — it is paid once it is due and above your minimum payout.`}
      </p>
      <h2 className="mt-6 font-semibold">Detail</h2>
      <table className="mt-2 w-full text-xs">
        <thead className="text-left text-ink/50"><tr><th className="py-1">Type</th><th>Description</th><th>Contract</th><th className="text-right">Amount</th></tr></thead>
        <tbody className="divide-y divide-ink/5">
          {entries.map((e) => (
            <tr key={e.id}><td className="py-1">{kindLabel[e.kind] ?? e.kind}</td><td>{e.memo}</td><td>{e.contract_ref}</td><td className="text-right tabular-nums">{formatMoney(e.amount_minor)}</td></tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={4} className="py-2 text-ink/50">No earnings this month.</td></tr>}
        </tbody>
      </table>
      <footer className="mt-8 border-t border-ink/15 pt-3 text-xs text-ink/50">
        Royalties are a share of net subscription receipts (excluding GST and payment fees) from paying families who watched your workouts, split household by household.
        Statements are final once issued; any later correction appears as an adjustment in a future month. GST and tax treatment of these payments is being confirmed with our accountant.
      </footer>
    </main>
  );
}
