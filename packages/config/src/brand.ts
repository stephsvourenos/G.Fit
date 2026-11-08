/**
 * Working name "G.Fit" (final name to be confirmed before app-store listings and the domain).
 * Everything user-facing reads from here, so renaming the product is a one-file change.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "G.Fit",
  tagline: "Move together. Every age, every day.",
  supportEmail: "support@example.com",
  defaultCurrency: "AUD" as const,
  defaultCountry: "AU" as const,
  colours: {
    ink: "#0E1116",
    paper: "#F7F4EE",
    accent: "#FF5A36",
    accent2: "#2E6BFF",
    mint: "#21C08B",
    sun: "#FFC23D",
  },
} as const;

export type Brand = typeof brand;
