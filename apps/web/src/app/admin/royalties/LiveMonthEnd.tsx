"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { creatorNames, monthEnd, previousMonth, type StatementRow } from "@/lib/finance";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface RunRow {
  run_id: string;
  month: string;
  status: "provisional" | "final";
  net_receipts_minor: number;
  royalty_pool_minor: number;
  royalty_allocated_minor: number;
  royalty_retained_minor: number;
  referral_minor: number;
  adjustments_minor: number;
  entry_count: number;
  fingerprint: string;
  created_by: string | null;
  created_at: string;
}
interface Result extends Omit<RunRow, "run_id" | "created_at"> {
  ok?: boolean;
  statements: StatementRow[];
  input_counts: Record<string, number>;
}

const money = (n: number) => formatMoney(Number(n));
const fetchRuns = () =>
  supabase().from("month_end_runs").select("run_id, month, status, net_receipts_minor, royalty_pool_minor, royalty_allocated_minor, royalty_retained_minor, referral_minor, adjustments_minor, entry_count, fingerprint, created_by, created_at").order("month", { ascending: false }).order("status");

/**
 * Month-end: preview (re-runnable) → check → finalise (permanent). Finance/admin only.
 * The same rules as the unit tests run on the server against real invoices and paid viewing.
 */
export function LiveMonthEnd({ demo }: { demo: ReactNode }) {
  const [runs, setRuns] = useState<RunRow[]>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(previousMonth);
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState<string>();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [confirm, setConfirm] = useState("");

  const reload = () =>
    fetchRuns().then(({ data, error }) => (error ? setMsg({ tone: "err", text: friendlyError(error) }) : setRuns((data ?? []) as RunRow[])));

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchRuns().then(({ data }) => setRuns((data ?? []) as RunRow[]));
    creatorNames().then(setNames);
  }, []);
  if (!supabaseConfigured) return <>{demo}</>;

  const act = async (action: "preview" | "final" | "verify", m = month) => {
    setBusy(action);
    setMsg(undefined);
    const r = await monthEnd<Result & { matches?: boolean; final?: string; recomputed?: string }>({ action, month: m });
    setBusy(undefined);
    if (r.error) return setMsg({ tone: "err", text: r.error });
    if (action === "verify") {
      return setMsg(
        r.matches
          ? { tone: "ok", text: `${m} reproduces exactly (fingerprint ${r.final}).` }
          : { tone: "err", text: `${m} does NOT reproduce: stored ${r.final}, recomputed ${r.recomputed}. Investigate before paying.` },
      );
    }
    setResult(r);
    setConfirm("");
    if (action === "final") setMsg({ tone: "ok", text: `${m} is now final: ${r.entry_count} ledger entries and statements written.` });
    reload();
  };

  const finalExists = runs?.some((r) => r.month === month && r.status === "final");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <label className="text-sm">
          Month
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setResult(undefined); }} className="mt-1 block rounded-lg border border-ink/15 px-3 py-2" />
        </label>
        <button onClick={() => act("preview")} disabled={!!busy || finalExists} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40">
          {busy === "preview" ? "Calculating…" : "Preview"}
        </button>
        {finalExists && (
          <button onClick={() => act("verify")} disabled={!!busy} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-ink/20 disabled:opacity-40">
            {busy === "verify" ? "Checking…" : "Verify it reproduces"}
          </button>
        )}
        <p className="text-xs text-ink/60 basis-full">
          Preview as often as you like. Finalising writes permanent ledger entries and creator statements — corrections after that are made as adjustments in a later month.
        </p>
      </div>
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}

      {result && (
        <section className="mb-8 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">{result.month} — {result.status === "final" ? "final" : "preview"}</h2>
            <Badge tone={result.status === "final" ? "green" : "amber"}>{result.status}</Badge>
            <span className="font-mono text-xs text-ink/50">fingerprint {result.fingerprint}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Net receipts" value={money(result.net_receipts_minor)} />
            <Kpi label="Royalty pool" value={money(result.royalty_pool_minor)} />
            <Kpi label="Allocated / kept" value={`${money(result.royalty_allocated_minor)} / ${money(result.royalty_retained_minor)}`} />
            <Kpi label="Referral" value={money(result.referral_minor)} />
            <Kpi label="Refund adjustments" value={money(result.adjustments_minor)} />
          </div>
          <p className="mt-3 text-xs text-ink/50">
            Inputs: {Object.entries(result.input_counts ?? {}).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ")} · paid viewing only (trials and test memberships excluded)
          </p>
          <div className="mt-4">
            <Table head={["Creator", "Royalties", "Referral", "Adjustments", "Closing balance", "Payable", "Carried forward", "Next pay date"]}>
              {result.statements.map((s) => (
                <tr key={s.creator_id}>
                  <td className="px-4 py-3 font-semibold">{names[s.creator_id] ?? s.creator_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{money(s.royalties_minor)}</td>
                  <td className="px-4 py-3">{money(s.referrals_minor)}</td>
                  <td className="px-4 py-3">{money(s.adjustments_minor)}</td>
                  <td className="px-4 py-3 font-semibold">{money(s.closing_balance_minor)}</td>
                  <td className="px-4 py-3">{money(s.payable_minor)}</td>
                  <td className="px-4 py-3">
                    {money(s.carried_forward_minor)}
                    {s.payable_status === "below-minimum-carry-forward" && <div className="text-xs text-ink/50">below minimum</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{s.next_pay_date}</td>
                </tr>
              ))}
            </Table>
          </div>
          {result.status === "provisional" && (
            <div className="mt-5 rounded-xl border border-coral/30 p-4">
              <p className="text-sm">
                Finalise <strong>{result.month}</strong>? This writes {result.entry_count} permanent ledger entries and the statements above.
                Type <strong>FINALISE</strong> to confirm.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-lg border border-ink/15 px-3 py-2" aria-label="Type FINALISE to confirm" />
                <button onClick={() => act("final", result.month)} disabled={confirm !== "FINALISE" || !!busy} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  {busy === "final" ? "Finalising…" : "Finalise month"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <h2 className="mb-3 font-semibold">Runs</h2>
      {!runs ? (
        <p className="text-ink/60">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No month-end runs yet. Pick a month and press Preview.</p>
      ) : (
        <Table head={["Month", "Status", "Net receipts", "Pool", "Allocated", "Referral", "Adjustments", "Entries", "Fingerprint", "By"]}>
          {runs.map((r) => (
            <tr key={r.run_id}>
              <td className="px-4 py-3 font-semibold">{r.month}</td>
              <td className="px-4 py-3"><Badge tone={r.status === "final" ? "green" : "amber"}>{r.status === "final" ? "final" : "preview"}</Badge></td>
              <td className="px-4 py-3">{money(r.net_receipts_minor)}</td>
              <td className="px-4 py-3">{money(r.royalty_pool_minor)}</td>
              <td className="px-4 py-3">{money(r.royalty_allocated_minor)}</td>
              <td className="px-4 py-3">{money(r.referral_minor)}</td>
              <td className="px-4 py-3">{money(r.adjustments_minor)}</td>
              <td className="px-4 py-3">{r.entry_count}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.fingerprint}</td>
              <td className="px-4 py-3 text-xs">{r.created_by}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
