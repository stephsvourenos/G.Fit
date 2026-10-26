import { formatMoney, gstIncludedMinor } from "@app/domain";
import { attributions, creators, households, invoices } from "@app/mock-data";
import { Badge, Kpi, PageHeader, Table } from "@/components/AdminShell";

const PLAN_LABEL = { founder: "Founder monthly (grandfathered)", monthly: "Family monthly", promo: "Launch promo → monthly", annual: "Family annual" };

export default function SubscribersPage() {
  const list = households.slice(0, 60);
  const count = (s: string) => households.filter((h) => h.status === s).length;
  return (
    <>
      <PageHeader title="Subscribers & entitlements" sub="Billing facts come from Stripe (the source of truth) via verified webhooks; we store IDs and snapshots. Showing the first 60 of the demo households. No child data is shown here." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active" value={String(count("active"))} />
        <Kpi label="Past due (grace)" value={String(count("past_due"))} />
        <Kpi label="Cancelled" value={String(count("canceled"))} />
        <Kpi label="Referred" value={String(attributions.length)} />
      </div>
      <div className="mt-6">
        <Table head={["Household", "Plan", "Last charge", "GST", "Status", "Profiles", "Stripe IDs", "Referred by"]}>
          {list.map((h) => {
            const last = invoices.filter((i) => i.householdId === h.id).at(-1);
            const ref = attributions.find((a) => a.householdId === h.id);
            return (
              <tr key={h.id}>
                <td className="px-4 py-3 font-semibold">{h.label}<div className="text-xs font-normal text-ink/50">joined {h.joinedMonth}</div></td>
                <td className="px-4 py-3 text-xs">{PLAN_LABEL[h.plan]}</td>
                <td className="px-4 py-3">{last ? formatMoney(last.grossPaidMinor) : "—"}<div className="text-xs text-ink/50">{last?.serviceStartMonth}</div></td>
                <td className="px-4 py-3 text-xs">{last ? formatMoney(gstIncludedMinor(last.grossPaidMinor)) : "—"}</td>
                <td className="px-4 py-3"><Badge tone={h.status === "active" ? "green" : h.status === "past_due" ? "amber" : "grey"}>{h.status}</Badge></td>
                <td className="px-4 py-3">{h.profiles}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-ink/60">{h.stripeCustomerId}<br />{h.stripeSubscriptionId}</td>
                <td className="px-4 py-3 text-xs">{ref ? `${creators.find((c) => c.id === ref.creatorId)?.displayName} (${ref.terms.rateBps / 100}% × ${ref.terms.maxPaidMonths} mo)` : "—"}</td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}
