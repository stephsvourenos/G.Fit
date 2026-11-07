"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Ent { household_id: string; provider: string; provider_customer_id: string | null; provider_subscription_id: string | null; status: string; current_period_end: string }
interface Inv { id: string; household_id: string; status: string; amount_paid_minor: number; gst_minor: number; billing_interval: string | null; paid_at: string | null; livemode: boolean }
interface Ref { household_id: string; referral_code: string; creators: { display_name: string } | null }
interface Rf { household_id: string; amount_minor: number }

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }) : "—";

async function fetchAll() {
  const db = supabase();
  const [e, i, r, f] = await Promise.all([
    db.from("entitlements").select("household_id, provider, provider_customer_id, provider_subscription_id, status, current_period_end").order("updated_at", { ascending: false }),
    db.from("billing_invoices").select("id, household_id, status, amount_paid_minor, gst_minor, billing_interval, paid_at, livemode").order("paid_at", { ascending: false }),
    db.from("referral_attributions").select("household_id, referral_code, creators(display_name)"),
    db.from("billing_refunds").select("household_id, amount_minor"),
  ]);
  const err = e.error ?? i.error ?? r.error ?? f.error;
  return { err, ents: (e.data ?? []) as Ent[], invs: (i.data ?? []) as Inv[], refs: (r.data ?? []) as unknown as Ref[], refunds: (f.data ?? []) as Rf[] };
}

/** Real memberships (Stripe test mode + test grants). Household IDs only — no names, no child data. */
export function LiveSubscribers({ demo }: { demo: ReactNode }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAll>>>();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseConfigured) fetchAll().then(setData);
  }, []);
  if (!supabaseConfigured) return <>{demo}</>;

  const reconcile = async () => {
    setBusy(true);
    const { data: r, error } = await supabase().functions.invoke("billing-reconcile", { body: {} });
    setBusy(false);
    setNote(error ? "Couldn't check with Stripe — admin or finance staff only, and Stripe must be connected." : `Checked ${r.customers} customer(s): ${r.subscriptions} subscription(s), ${r.invoices} invoice(s).`);
    fetchAll().then(setData);
  };

  if (!data) return <p className="text-ink/60">Loading…</p>;
  if (data.err) return <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{friendlyError(data.err)}</p>;

  const paidInvs = data.invs.filter((i) => i.status === "paid");
  const revenue = paidInvs.reduce((a, i) => a + i.amount_paid_minor, 0);
  const refunded = data.refunds.reduce((a, r) => a + r.amount_minor, 0);
  const count = (s: string) => data.ents.filter((e) => e.provider === "stripe" && e.status === s).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Paying (Stripe test)" value={String(count("active") + count("trialing"))} />
        <Kpi label="Past due (grace)" value={String(count("past_due"))} />
        <Kpi label="Collected (test)" value={formatMoney(revenue - refunded)} />
        <Kpi label="Referred" value={String(data.refs.length)} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={reconcile} disabled={busy} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
          {busy ? "Checking…" : "Check with Stripe now"}
        </button>
        <span className="text-sm text-ink/60">Runs automatically every night. {note}</span>
      </div>
      <div className="mt-6">
        {data.ents.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No memberships yet.</p>
        ) : (
          <Table head={["Household", "Source", "Status", "Period ends", "Last payment", "GST", "Total paid", "Refunded", "Referred by", "Stripe IDs"]}>
            {data.ents.map((e) => {
              const invs = paidInvs.filter((i) => i.household_id === e.household_id);
              const last = invs[0];
              const total = invs.reduce((a, i) => a + i.amount_paid_minor, 0);
              const rf = data.refunds.filter((r) => r.household_id === e.household_id).reduce((a, r) => a + r.amount_minor, 0);
              const ref = data.refs.find((r) => r.household_id === e.household_id);
              return (
                <tr key={e.household_id}>
                  <td className="px-4 py-3 font-mono text-xs">{e.household_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{e.provider === "stripe" ? "Stripe" : e.provider === "manual_grant" ? "Test grant" : e.provider}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.status === "active" || e.status === "trialing" ? "green" : e.status === "past_due" ? "amber" : "grey"}>{e.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{fmt(e.current_period_end)}</td>
                  <td className="px-4 py-3">{last ? formatMoney(last.amount_paid_minor) : "—"}<div className="text-xs text-ink/50">{last ? `${fmt(last.paid_at)} · ${last.billing_interval ?? ""}` : ""}</div></td>
                  <td className="px-4 py-3 text-xs">{last ? formatMoney(last.gst_minor) : "—"}</td>
                  <td className="px-4 py-3">{total ? formatMoney(total) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{rf ? formatMoney(rf) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{ref ? `${ref.creators?.display_name ?? "?"} (${ref.referral_code})` : "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink/60">{e.provider_customer_id ?? ""}<br />{e.provider_subscription_id ?? ""}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
    </>
  );
}
