"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Month {
  month: string; gross_minor: number; gst_minor: number; fees_minor: number; refunds_minor: number; net_cash_minor: number;
  new_paying: number; churned: number; paying_households: number; recognised_net_minor: number | null; run_status: string | null;
  creator_cost_minor: number; video_cost_minor: number; qualified_minutes: number; contribution_minor: number | null;
}
interface Report {
  test_mode: boolean;
  snapshot: { active: number; cancelling: number; trialing: number; past_due: number; mrr_minor: number; paying: number; arpu_minor: number };
  trials: { started: number; converted: number; ended_without_paying: number; in_progress: number; refused_reused_card: number };
  months: Month[];
  cohorts: { cohort: string; size: number; retained: number[] }[];
}
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export function LiveReports() {
  const [r, setR] = useState<Report>();
  const [error, setError] = useState<string>();
  const [months, setMonths] = useState(12);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase().rpc("finance_report", { p_months: months }).then(({ data, error }) => {
      if (error) setError(friendlyError(error));
      else setR(data as Report);
    });
  }, [months]);

  if (!supabaseConfigured) return <p className="text-ink/60">Reports need the live database.</p>;
  if (error) return <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{error}</p>;
  if (!r) return <p className="text-ink/60">Loading…</p>;

  const s = r.snapshot, t = r.trials;
  const decided = t.converted + t.ended_without_paying;
  // Skip the empty months before anything happened (pre-launch).
  const firstActive = r.months.findIndex((m) => m.gross_minor || m.run_status || m.paying_households || m.qualified_minutes);
  const shown = firstActive < 0 ? r.months.slice(-1) : r.months.slice(firstActive);
  const recent = shown.slice().reverse();
  const opening = (i: number) => r.months[i - 1]?.paying_households ?? 0;

  return (
    <>
      {r.test_mode && <p className="mb-4 rounded-xl bg-sky/10 px-4 py-2.5 text-sm text-ink">Stripe test mode — these are test payments, not real revenue.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Paying families" value={String(s.active)} hint={`${s.cancelling} cancelling at period end`} />
        <Kpi label="On free trial" value={String(s.trialing)} hint={`${s.past_due} with a failed payment`} />
        <Kpi label="Monthly recurring revenue" value={formatMoney(s.mrr_minor)} hint="ex GST · annual plans ÷ 12" />
        <Kpi label="Average per paying family" value={formatMoney(s.arpu_minor)} hint="per month, ex GST" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Trials started" value={String(t.started)} hint={`${t.in_progress} still running`} />
        <Kpi label="Trial → paid" value={pct(t.converted, decided)} hint={`${t.converted} of ${decided} finished trials`} />
        <Kpi label="Trials ended unpaid" value={String(t.ended_without_paying)} />
        <Kpi label="Repeat-trial attempts blocked" value={String(t.refused_reused_card)} hint="same card used before" />
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Month by month</h2>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded border border-ink/20 px-2 py-1 text-sm">
          {[3, 6, 12, 24].map((n) => <option key={n} value={n}>Last {n} months</option>)}
        </select>
      </div>
      <Table head={["Month", "Cash in (incl GST)", "GST", "Card fees", "Refunds", "Net cash", "Earned (net)", "Creators", "Video", "Contribution", "New", "Left", "Churn"]}>
        {recent.map((m) => {
          const i = r.months.indexOf(m);
          return (
            <tr key={m.month}>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{m.month}</td>
              <td className="px-4 py-3">{formatMoney(m.gross_minor)}</td>
              <td className="px-4 py-3 text-ink/60">{formatMoney(m.gst_minor)}</td>
              <td className="px-4 py-3 text-ink/60">{formatMoney(m.fees_minor)}</td>
              <td className="px-4 py-3 text-ink/60">{m.refunds_minor ? `−${formatMoney(m.refunds_minor)}` : "—"}</td>
              <td className="px-4 py-3">{formatMoney(m.net_cash_minor)}</td>
              <td className="px-4 py-3">{m.recognised_net_minor == null ? "—" : formatMoney(m.recognised_net_minor)}</td>
              <td className="px-4 py-3">{m.recognised_net_minor == null ? "—" : formatMoney(m.creator_cost_minor)}</td>
              <td className="px-4 py-3">{formatMoney(m.video_cost_minor)}</td>
              <td className="px-4 py-3 font-semibold">
                {m.contribution_minor == null ? <span className="text-xs font-normal text-ink/50">run month-end</span> : (
                  <>{formatMoney(m.contribution_minor)} {m.run_status !== "final" && <Badge tone="amber">preview</Badge>}</>
                )}
              </td>
              <td className="px-4 py-3">{m.new_paying}</td>
              <td className="px-4 py-3">{m.churned}</td>
              <td className="px-4 py-3">{pct(m.churned, opening(i))}</td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-2 max-w-4xl text-xs text-ink/50">
        <b>Cash in</b> is what was charged that month; an annual plan shows in full in the month it was paid. <b>Earned (net)</b> is the month-end figure: after GST and card fees,
        with annual plans spread over 12 months — that’s the base for creator royalties. <b>Contribution</b> = earned − creator royalties and referral commission − video delivery
        (set the cost per 1,000 minutes in Configuration). It doesn’t include your other costs (wages, marketing, software). <b>Churn</b> = families whose membership ended that month ÷ paying families at the start of the month.
      </p>

      <h2 className="mt-8 mb-3 font-semibold">Do families stay? (by the month they first paid)</h2>
      {r.cohorts.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No paying families yet.</p>
      ) : (
        <Table head={["First paid", "Families", ...Array.from({ length: Math.max(...r.cohorts.map((c) => c.retained.length)) }, (_, k) => `Month ${k + 1}`)]}>
          {r.cohorts.map((c) => (
            <tr key={c.cohort}>
              <td className="px-4 py-3 font-semibold">{c.cohort}</td>
              <td className="px-4 py-3">{c.size}</td>
              {c.retained.map((n, k) => <td key={k} className="px-4 py-3">{pct(n, c.size)}</td>)}
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-2 text-xs text-ink/50">A family counts as staying in a month if a paid membership (monthly or annual) covered it.</p>
    </>
  );
}
