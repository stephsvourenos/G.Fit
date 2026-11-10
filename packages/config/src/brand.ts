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
    ink: "#15131C",
    paper: "#F4F2F8",
    accent: "#E0177A",
    accent2: "#4CC9F0",
    mint: "#3FD08F",
    sun: "#FFB703",
  },
} as const;

export type Brand = typeof brand;
