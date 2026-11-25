"use client";

import Link from "next/link";
import { Table } from "@/components/AdminShell";
import { addDays, db, fmtDate, useLoad } from "@/lib/crm";
import { Bar, Notice } from "./_ui";

interface Dash {
  today: string;
  targets: Record<string, number | string>;
  days_to_launch: number;
  total: number;
  new_today: number;
  qualified: number;
  contacted: number;
  responded: number;
  positive: number;
  applied: number;
  approved: number;
  signed: number;
  onboarding: number;
  launch_ready: number;
  do_not_contact: number;
  by_country: Array<{ name: string; total: number; contacted: number; signed: number }>;
  by_source: Array<{ name: string; total: number; contacted: number; signed: number }>;
  categories: Array<{ name: string; target: number; qualified: number; contacted: number; interested: number; signed: number; launch_ready: number }>;
  uncategorised: number;
  daily: Array<{ day: string; added: number; contacted: number; replies: number }>;
  overdue_follow_ups: number;
  incomplete_research: number;
  no_channel: number;
  launch_ready_last_14: number;
  signed_last_14: number;
  contacted_last_7: number;
  published_workouts: number;
  creators_with_min_workouts: number;
  creators_with_any_workout: number;
}

const n = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

export function Overview() {
  const { data: d, error, loading } = useLoad<Dash>(async () => {
    const { data, error } = await db().rpc("crm_dashboard");
    if (error) throw error;
    return data as Dash;
  });
  if (error) return <Notice tone="error">{error}</Notice>;
  if (loading || !d) return <p className="text-ink/60">Loading the dashboard…</p>;

  const t = d.targets;
  const founding = n(t.founding_creators);
  const remainingPlaces = Math.max(0, founding - d.launch_ready);
  const days = Math.max(0, d.days_to_launch);
  const neededPerDay = days > 0 ? remainingPlaces / days : null;
  // Forecast only from real recent pace; a handful of events is not a trend.
  const pace = d.launch_ready_last_14 / 14;
  const forecast = d.launch_ready_last_14 >= 5 && pace > 0 ? addDays(d.today, Math.ceil(remainingPlaces / pace)) : null;
  const contactPacePerDay = d.contacted_last_7 / 7;

  return (
    <div className="space-y-8">
      {d.total === 0 && (
        <Notice tone="info">
          No prospects yet. Start by <Link href="/admin/acquisition/import/" className="font-semibold underline">importing a research file</Link> from ChatGPT Work — then Today’s Tasks will tell you who to contact first.
        </Notice>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Target label="Launch-ready founding creators" value={d.launch_ready} target={founding} tone="coral"
          hint={`${remainingPlaces} founding places remaining`} />
        <Target label="Signed creators (agreement accepted)" value={d.signed} target={n(t.signed_creators)} />
        <Target label="Qualified prospects" value={d.qualified} target={n(t.qualified_prospects)} hint="Qualified stage or later, or research tier A–C" />
        <Target label="Approved workout library" value={d.published_workouts} target={n(t.workout_library)} hint="Published workouts on G.Fit today" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Days to launch" value={days} sub={fmtDate(String(t.launch_date))} />
        <Stat label="Total prospects" value={d.total} sub={`${d.new_today} added today`} />
        <Stat label="Contacted" value={d.contacted} />
        <Stat label="Responses" value={d.responded} sub={`${d.positive} positive`} />
        <Stat label="Applications" value={d.applied} sub={`${d.approved} approved`} />
        <Stat label="Onboarding" value={d.onboarding} />
        <Stat label="Creators with ≥ 1 approved workout" value={d.creators_with_any_workout} />
        <Stat label={`Creators with ≥ ${n(t.min_approved_workouts)} approved workouts`} value={d.creators_with_min_workouts} />
        <Stat label="Committed to launch promotion" value={null} sub="Tracked from Phase 3" />
        <Stat label="Overdue follow-ups" value={d.overdue_follow_ups} tone={d.overdue_follow_ups ? "coral" : undefined} link="/admin/acquisition/today/" />
        <Stat label="Research incomplete" value={d.incomplete_research} sub="No category, score or contact route" link="/admin/acquisition/prospects/?filter=incomplete" />
        <Stat label="Do not contact" value={d.do_not_contact} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Pace to launch</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Needed per day to fill every founding place" v={neededPerDay === null ? "Launch date reached" : `${neededPerDay.toFixed(1)} launch-ready creators a day`} />
            <Row k="Launch-ready in the last 14 days" v={`${d.launch_ready_last_14}`} />
            <Row k="Estimated date for all founding places" v={forecast ? `${fmtDate(forecast)} (estimate, at the last 14 days' pace)` : "Not enough data yet — needs at least 5 launch-ready creators in the last 14 days"} />
            <Row k="Creators contacted per day (last 7 days)" v={contactPacePerDay.toFixed(1)} />
          </dl>
          <p className="mt-3 text-xs text-ink/50">Forecasts are estimates from recent activity, not guarantees. Launch-ready is set by real events once onboarding tracking arrives (Phase 2).</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Conversion between stages</h2>
          <p className="mt-1 text-xs text-ink/50">Each prospect counts once, however often a card moves back and forth.</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Prospects → contacted" v={`${pct(d.contacted, d.total)} (${d.contacted} of ${d.total})`} />
            <Row k="Contacted → responded" v={`${pct(d.responded, d.contacted)} (${d.responded})`} />
            <Row k="Responded → interested" v={`${pct(d.positive, d.responded)} (${d.positive})`} />
            <Row k="Interested → applied" v={`${pct(d.applied, d.positive)} (${d.applied})`} />
            <Row k="Applied → approved" v={`${pct(d.approved, d.applied)} (${d.approved})`} />
            <Row k="Approved → agreement accepted" v={`${pct(d.signed, d.approved)} (${d.signed})`} />
            <Row k="Agreement → launch-ready" v={`${pct(d.launch_ready, d.signed)} (${d.launch_ready})`} />
          </dl>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl">Last 30 days</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Spark title="Prospects added" data={d.daily.map((x) => ({ day: x.day, v: x.added }))} />
          <Spark title="Creators contacted" data={d.daily.map((x) => ({ day: x.day, v: x.contacted }))} />
          <Spark title="Creators who replied" data={d.daily.map((x) => ({ day: x.day, v: x.replies }))} />
        </div>
      </section>

      <section>
        <h2 className="font-display mb-1 text-xl">Founding creators by category</h2>
        <p className="mb-3 text-xs text-ink/50">Each creator counts once, in their primary category. {d.uncategorised > 0 && <>{d.uncategorised} prospects don’t match a founding category yet.</>}</p>
        <Table head={["Category", "Target", "Qualified", "Contacted", "Interested", "Signed", "Launch-ready", "Gap"]}>
          {d.categories.map((c) => (
            <tr key={c.name}>
              <td className="px-4 py-2.5 font-semibold">{c.name}</td>
              <td className="px-4 py-2.5">{c.target}</td>
              <td className="px-4 py-2.5">{c.qualified}</td>
              <td className="px-4 py-2.5">{c.contacted}</td>
              <td className="px-4 py-2.5">{c.interested}</td>
              <td className="px-4 py-2.5">{c.signed}</td>
              <td className="px-4 py-2.5">{c.launch_ready}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-8 tabular-nums">{Math.max(0, c.target - c.launch_ready)}</span>
                  <div className="w-24"><Bar value={c.launch_ready} max={c.target} tone="mint" /></div>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="By country" rows={d.by_country} />
        <Breakdown title="By recruitment source" rows={d.by_source} />
      </section>

      <section className="rounded-xl bg-white p-5 text-sm ring-1 ring-ink/5">
        <h2 className="font-display text-xl">Launch-readiness risks</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
          {d.overdue_follow_ups > 0 && <li>{d.overdue_follow_ups} follow-ups are overdue.</li>}
          {d.no_channel > 0 && <li>{d.no_channel} uncontacted prospects have no usable contact route (no profile link or email).</li>}
          {neededPerDay !== null && neededPerDay > 0 && d.launch_ready_last_14 / 14 < neededPerDay && (
            <li>Recent pace is below the {neededPerDay.toFixed(1)} launch-ready creators a day needed to fill every founding place by launch.</li>
          )}
          {d.published_workouts < n(t.workout_library) && <li>The workout library has {d.published_workouts} of {n(t.workout_library)} approved workouts. The current video plan allows only a small number of videos; a paid plan is needed before uploading the full library.</li>}
          <li>Onboarding bottlenecks, agreement status and promotion commitments will show here once Phase 2–3 connect them to real events.</li>
        </ul>
      </section>
    </div>
  );
}

function Target({ label, value, target, hint, tone }: { label: string; value: number; target: number; hint?: string; tone?: "coral" }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="font-display mt-1 text-3xl tabular-nums">{value.toLocaleString("en-AU")} <span className="text-base text-ink/45">/ {target.toLocaleString("en-AU")}</span></div>
      <div className="mt-2"><Bar value={value} max={target} tone={tone === "coral" ? "coral" : "ink"} /></div>
      <div className="mt-1.5 text-xs text-ink/50">{pct(value, target)} of target{hint ? ` · ${hint}` : ""}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone, link }: { label: string; value: number | null; sub?: string; tone?: "coral"; link?: string }) {
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`font-display mt-1 text-2xl tabular-nums ${tone === "coral" ? "text-coral" : ""}`}>{value === null ? "—" : value.toLocaleString("en-AU")}</div>
      {sub && <div className="text-xs text-ink/50">{sub}</div>}
    </>
  );
  const cls = "block rounded-xl bg-white p-4 ring-1 ring-ink/5";
  return link ? <Link href={link} className={`${cls} hover:ring-ink/20`}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink/5 pb-2 last:border-0">
      <dt className="text-ink/60">{k}</dt>
      <dd className="text-right font-semibold tabular-nums">{v}</dd>
    </div>
  );
}

/** One measure per chart, one colour, values on hover and the total in words. */
function Spark({ title, data }: { title: string; data: Array<{ day: string; v: number }> }) {
  const max = Math.max(1, ...data.map((x) => x.v));
  const total = data.reduce((s, x) => s + x.v, 0);
  return (
    <figure className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="tabular-nums text-ink/60">{total.toLocaleString("en-AU")} in 30 days</span>
      </figcaption>
      <div className="mt-3 flex h-20 items-end gap-[2px]" role="img" aria-label={`${title}: ${total} over the last 30 days; most in a day ${max}`}>
        {data.map((x) => (
          <div key={x.day} className="group relative flex h-full flex-1 items-end" title={`${fmtDate(x.day)}: ${x.v}`}>
            <div className="w-full rounded-t-[4px] bg-ink group-hover:bg-sky" style={{ height: x.v ? `${Math.max(4, (x.v / max) * 100)}%` : "2px", opacity: x.v ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink/45"><span>{fmtDate(data[0]?.day)}</span><span>today</span></div>
    </figure>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ name: string; total: number; contacted: number; signed: number }> }) {
  return (
    <div>
      <h2 className="font-display mb-3 text-xl">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-ink/55">No prospects yet.</p> : (
        <Table head={["", "Prospects", "Contacted", "Signed"]}>
          {rows.map((r) => (
            <tr key={r.name}><td className="px-4 py-2">{r.name}</td><td className="px-4 py-2">{r.total}</td><td className="px-4 py-2">{r.contacted}</td><td className="px-4 py-2">{r.signed}</td></tr>
          ))}
        </Table>
      )}
    </div>
  );
}
