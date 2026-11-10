"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Kpi } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Report {
  test_mode: boolean;
  snapshot: { active: number; cancelling: number; trialing: number; past_due: number; mrr_minor: number };
  months: { month: string; net_cash_minor: number; recognised_net_minor: number | null; run_status: string | null; contribution_minor: number | null }[];
}

async function load() {
  const db = supabase();
  const [rep, review, batches, problems, emails, email] = await Promise.all([
    db.rpc("finance_report", { p_months: 6 }),
    db.from("workouts").select("id", { count: "exact", head: true }).in("state", ["awaiting-review", "approved"]),
    db.from("payout_batches").select("id, status").in("status", ["draft", "approved", "exported"]),
    db.from("system_events").select("id, level", { count: "exact" }).is("resolved_at", null),
    db.from("member_notices").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.functions.invoke("send-emails", { body: { action: "status" } }),
  ]);
  return {
    report: rep.error ? null : (rep.data as Report),
    reportError: rep.error ? friendlyError(rep.error) : null,
    awaitingReview: review.count ?? 0,
    batches: (batches.data ?? []) as { id: string; status: string }[],
    problems: (problems.data ?? []) as { level: string }[],
    failedEmails: emails.count ?? 0,
    emailConnected: (email.data as { provider?: string } | null)?.provider === "connected",
  };
}

/** Admin home: real numbers and the things that need someone today. */
export function LiveOverview({ demo }: { demo: ReactNode }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof load>>>();
  useEffect(() => { if (supabaseConfigured) void load().then(setD); }, []);
  if (!supabaseConfigured) return <>{demo}</>;
  if (!d) return <p className="text-ink/60">Loading…</p>;
  const r = d.report;
  const months = r?.months.filter((m) => m.net_cash_minor || m.run_status) ?? [];
  const max = Math.max(1, ...months.map((m) => m.recognised_net_minor ?? m.net_cash_minor));
  const lastMonth = months.at(-2);
  const todo: Array<[string, string, string]> = [];
  if (d.awaitingReview) todo.push([`${d.awaitingReview} workout${d.awaitingReview === 1 ? "" : "s"} waiting for review or publishing`, "/admin/content/", "Review"]);
  for (const b of d.batches) todo.push([`Payout batch ${b.id.slice(0, 6).toUpperCase()} is ${b.status === "draft" ? "waiting for a second person to approve" : b.status === "approved" ? "approved — make the bank file" : "sent to the bank — reconcile and confirm"}`, "/admin/payouts/", "Open"]);
  if (lastMonth && lastMonth.run_status !== "final") todo.push([`${lastMonth.month} royalties aren’t finalised yet`, "/admin/royalties/", "Open"]);
  const errors = d.problems.filter((p) => p.level === "error").length;
  if (d.problems.length) todo.push([`${d.problems.length} open system problem${d.problems.length === 1 ? "" : "s"}${errors ? ` (${errors} error${errors === 1 ? "" : "s"})` : ""}`, "/admin/health/", "Check"]);
  if (d.failedEmails) todo.push([`${d.failedEmails} member email${d.failedEmails === 1 ? "" : "s"} failed`, "/admin/emails/", "Check"]);
  if (r && r.snapshot.past_due) todo.push([`${r.snapshot.past_due} famil${r.snapshot.past_due === 1 ? "y has" : "ies have"} a failed payment`, "/admin/subscribers/", "View"]);

  return (
    <>
      {d.reportError && <p role="alert" className="mb-4 rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{d.reportError}</p>}
      {r && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Paying families" value={String(r.snapshot.active)} hint={`${r.snapshot.cancelling} cancelling`} />
          <Kpi label="On free trial" value={String(r.snapshot.trialing)} hint={`${r.snapshot.past_due} payment issues`} />
          <Kpi label="Monthly recurring revenue" value={formatMoney(r.snapshot.mrr_minor)} hint="ex GST" />
          <Kpi label={`Contribution (${lastMonth?.month ?? "last month"})`} value={lastMonth?.contribution_minor != null ? formatMoney(lastMonth.contribution_minor) : "—"} hint="after creators & video" />
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Earned (net) by month</h2>
          {months.length === 0 ? <p className="mt-4 text-sm text-ink/60">No paid months yet.</p> : (
            <div className="mt-6 flex h-48 items-end gap-4">
              {months.map((m) => {
                const v = m.recognised_net_minor ?? m.net_cash_minor;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                    <div className="text-xs tabular-nums text-ink/60">{formatMoney(v).replace(".00", "")}</div>
                    <div className={`w-full rounded-t-md ${m.run_status === "final" ? "bg-ink" : "bg-ink/30"}`} style={{ height: `${Math.max(2, (v / max) * 140)}px` }} />
                    <div className="text-xs text-ink/60">{m.month.slice(5)}/{m.month.slice(2, 4)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-ink/50">After GST and card fees, annual plans spread over 12 months. Dark = finalised month. Details in <Link href="/admin/reports/" className="underline">Finance reports</Link>.</p>
        </section>
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Needs your attention</h2>
          {todo.length === 0 ? <p className="mt-3 text-sm text-ink/60">Nothing right now. ✓</p> : (
            <ul className="mt-3 space-y-3 text-sm">
              {todo.map(([text, href, cta]) => (
                <li key={text} className="flex items-start justify-between gap-3"><span>{text}</span><Link className="shrink-0 text-sky underline" href={href}>{cta}</Link></li>
              ))}
            </ul>
          )}
          <h2 className="mt-6 font-semibold">Connections</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Database & sign-in (Supabase)</span><Badge tone="green">connected</Badge></li>
            <li className="flex justify-between"><span>Payments (Stripe)</span>{r?.test_mode ? <Badge tone="amber">test mode</Badge> : <Badge tone="green">live</Badge>}</li>
            <li className="flex justify-between"><span>Video (Mux)</span><Badge tone="green">connected</Badge></li>
            <li className="flex justify-between"><span>Email</span>{d.emailConnected ? <Badge tone="green">connected</Badge> : <Badge tone="amber">not connected — emails kept, not sent</Badge>}</li>
            <li className="flex justify-between"><span>Bank payment file (ANZ)</span><Link href="/admin/settings/" className="text-sky underline">settings</Link></li>
          </ul>
        </section>
      </div>
    </>
  );
}
