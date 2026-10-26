import { PageHeader, Badge, Table } from "@/components/AdminShell";

const prices = [
  ["price_founder_999", "Founder monthly", "A$9.99 / month", false, "Grandfathered — 260 households remain on this price"],
  ["price_monthly_1499", "Family monthly", "A$14.99 / month", true, "Current public price"],
  ["price_annual_14999", "Family annual", "A$149.99 / year", true, "Current public price"],
] as const;
const coupons = [
  ["LAUNCH", "A$10.00 off for 3 months", "repeating", "Expires 31 Dec 2026"],
  ["FAMILYFRIEND", "20% off first month", "once", "Max 500 redemptions"],
];

export default function PricingPage() {
  return (
    <>
      <PageHeader title="Plans, pricing & promotions" sub="Mirrors Stripe: a price can never be edited, only replaced. Changing the public price creates a new price for new members; existing members keep theirs unless you run a planned, notified migration." />
      <Table head={["Stripe price", "Plan", "Amount (incl. GST)", "Status", "Notes"]}>
        {prices.map(([id, plan, amt, active, note]) => (
          <tr key={id}>
            <td className="px-4 py-3 font-mono text-xs">{id}</td>
            <td className="px-4 py-3 font-semibold">{plan}</td>
            <td className="px-4 py-3">{amt}</td>
            <td className="px-4 py-3">{active ? <Badge tone="green">selling</Badge> : <Badge tone="grey">closed to new sign-ups</Badge>}</td>
            <td className="px-4 py-3 text-xs text-ink/60">{note}</td>
          </tr>
        ))}
      </Table>
      <h2 className="mt-8 mb-3 font-semibold">Promotion codes</h2>
      <Table head={["Code", "Discount", "Duration", "Limits"]}>
        {coupons.map(([c, d, dur, lim]) => (
          <tr key={c}><td className="px-4 py-3 font-mono">{c}</td><td className="px-4 py-3">{d}</td><td className="px-4 py-3">{dur}</td><td className="px-4 py-3 text-xs">{lim}</td></tr>
        ))}
      </Table>
      <div className="mt-6 rounded-xl border border-dashed border-ink/20 p-4 text-sm text-ink/70">
        In Phase 3 these are created in Stripe (test mode first) and synced here. Price migrations for existing members
        use Stripe Subscription Schedules with advance notice, and require explicit confirmation in this screen.
      </div>
    </>
  );
}
