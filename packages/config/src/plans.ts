/**
 * Membership terms shown on the public website. These must match the Stripe prices (lookup keys
 * in packages/domain billing) — Stripe is the source of truth; checkout always charges what Stripe says.
 * Checked against the Stripe test-mode prices on 22 Nov 2026. Re-check after any price change.
 */
export const plans = {
  currency: "AUD",
  gstIncluded: true,
  trialDays: 7,
  maxProfiles: 6,
  monthly: { label: "Monthly", amount: 14.99, per: "month" },
  annual: { label: "Yearly", amount: 149.99, per: "year" },
} as const;

export const aud = (n: number) => `A$${n.toFixed(2)}`;

/** Yearly saving against twelve monthly payments, rounded down to a whole percent (never overstated). */
export const annualSavingPercent = Math.floor((1 - plans.annual.amount / (plans.monthly.amount * 12)) * 100);
export const annualMonthlyEquivalent = Math.floor((plans.annual.amount / 12) * 100) / 100;
