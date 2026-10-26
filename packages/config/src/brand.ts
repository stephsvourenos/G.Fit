/**
 * Branding is undecided. Everything user-facing reads from here, so renaming
 * the product is a one-file change (plus app-store listings later).
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "PROJECT_NAME",
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
