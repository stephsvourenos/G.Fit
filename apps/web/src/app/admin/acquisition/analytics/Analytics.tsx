"use client";

import { useState } from "react";
import { Table } from "@/components/AdminShell";
import { addDays, db, todaySydney, useLoad } from "@/lib/crm";
import { Notice, inputCls } from "../_ui";

interface FunnelRow { grp: string; prospects: number; contacted: number; responded: number; interested: number; applied: number; approved: number; signed: number; launch_ready: number }
interface Insights {
  avg_days_to_first_reply: number | null; replied_after_contact: number; avg_days_contact_to_agreement: number | null;
  objections: Array<{ text: string; n: number }>; reasons_lost: Array<{ text: string; n: number }>; messages_sent: number; prospects_messaged: number;
}

const GROUPS: Record<string, string> = {
  all: "Everything", source: "Recruitment source", platform: "Social platform", category: "Fitness category", country: "Country", tier: "Priority tier",
  template: "First outreach template", assigned: "Assigned staff member", batch: "Import batch",
};
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(b >= 100 ? 1 : 0)}%` : "—");

export function Analytics() {
  const today = todaySydney();
  const [from, setFrom] = useState(addDays(today, -89));
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState("all");
  const funnel = useLoad<FunnelRow[]>(async () => {
    const { data, error } = await db().rpc("crm_funnel", { p_from: from, p_to: to, p_group: group });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "grp" ? v : Number(v)]))) as FunnelRow[];
  }, [from, to, group]);
  const insights = useLoad<Insights>(async () => {
    const { data, error } = await db().rpc("crm_insights", { p_from: from, p_to: to });
    if (error) throw error;
    return data as Insights;
  }, [from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-3 ring-1 ring-ink/5">
        <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">Prospects added from</span><input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">to</span><input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">Break down by</span>
          <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}>{Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <div className="flex gap-1.5 pb-1">
          {[["Last 30 days", 29], ["Last 90 days", 89], ["Everything", 3650]].map(([l, d]) => <button key={l as string} className="rounded-full px-3 py-1 text-xs ring-1 ring-ink/15" onClick={() => { setFrom(addDays(today, -(d as number))); setTo(today); }}>{l}</button>)}
        </div>
      </div>
      {funnel.error && <Notice tone="error">{funnel.error}</Notice>}

      <section>
        <h2 className="font-display text-xl">Conversion funnel</h2>
        <p className="mb-3 text-xs text-ink/55">A cohort: the prospects first added in these dates, and how far each has got so far. Every prospect counts once per step, no matter how many messages or stage changes they had. Each % is of the step before; “Contacted → launch-ready” is end to end.</p>
        <Table head={[GROUPS[group]!, "Prospects", "Contacted", "→ Responded", "→ Interested", "→ Applied", "→ Approved", "→ Agreement", "→ Launch-ready", "Contacted → launch-ready"]}>
          {(funnel.data ?? []).map((r) => (
            <tr key={r.grp}>
              <td className="px-3 py-2 font-semibold">{r.grp}</td>
              <td className="px-3 py-2">{r.prospects}</td>
              <Cell n={r.contacted} of={r.prospects} />
              <Cell n={r.responded} of={r.contacted} />
              <Cell n={r.interested} of={r.responded} />
              <Cell n={r.applied} of={r.interested} />
              <Cell n={r.approved} of={r.applied} />
              <Cell n={r.signed} of={r.approved} />
              <Cell n={r.launch_ready} of={r.signed} />
              <td className="px-3 py-2">{pct(r.launch_ready, r.contacted)}</td>
            </tr>
          ))}
          {!funnel.loading && !funnel.data?.length && <tr><td colSpan={10} className="px-4 py-4 text-ink/55">No prospects were added in these dates.</td></tr>}
        </Table>
        <p className="mt-2 text-xs text-ink/50">Applications, approvals, agreements and launch readiness are recorded from real events once Phase 2 is live; until then they only change through admin overrides.</p>
      </section>

      {insights.data && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-5 text-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg">Timing</h2>
            <dl className="mt-2 space-y-2">
              <Def k="Average days from first message to first reply" v={insights.data.avg_days_to_first_reply ?? "Not enough replies yet"} />
              <Def k="Creators who replied" v={insights.data.replied_after_contact} />
              <Def k="Average days from first message to agreement" v={insights.data.avg_days_contact_to_agreement ?? "No agreements yet"} />
              <Def k="Messages sent in these dates" v={`${insights.data.messages_sent} to ${insights.data.prospects_messaged} creators`} />
              <Def k="Agreement → launch-ready, onboarding time" v="From Phase 2" />
            </dl>
          </div>
          <List title="Most common objections" rows={insights.data.objections} empty="No objections recorded yet. Add them when you record a reply." />
          <List title="Most common reasons for not proceeding" rows={insights.data.reasons_lost} empty="No closed prospects in these dates." />
        </section>
      )}
    </div>
  );
}

function Cell({ n, of }: { n: number; of: number }) {
  return <td className="px-3 py-2">{n} <span className="text-xs text-ink/50">{pct(n, of)}</span></td>;
}
function Def({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-ink/5 pb-2 last:border-0"><dt className="text-ink/60">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
function List({ title, rows, empty }: { title: string; rows: Array<{ text: string; n: number }>; empty: string }) {
  return (
    <div className="rounded-xl bg-white p-5 text-sm ring-1 ring-ink/5">
      <h2 className="font-display text-lg">{title}</h2>
      {rows.length ? <ol className="mt-2 space-y-1">{rows.map((r) => <li key={r.text} className="flex justify-between gap-3"><span>{r.text}</span><span className="tabular-nums text-ink/60">{r.n}</span></li>)}</ol> : <p className="mt-2 text-ink/55">{empty}</p>}
    </div>
  );
}
