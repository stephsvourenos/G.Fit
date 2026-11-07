import { PageHeader } from "@/components/AdminShell";
import { LivePricing } from "./LivePricing";

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="Plans, pricing & promotions"
        sub="Prices live in Stripe and are never edited — a price change is a new price for new members; existing members keep theirs. Founders keep A$9.99 for as long as their membership continues."
      />
      <LivePricing />
    </>
  );
}
