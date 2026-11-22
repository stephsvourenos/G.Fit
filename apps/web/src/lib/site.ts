/**
 * Public website address and whether search engines may index it.
 * The test site must never be indexed: indexing is on only when NEXT_PUBLIC_SITE_INDEXABLE=1,
 * which is set on the production domain at launch (docs/PRODUCTION_SETUP.md).
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://g-fit-liard.vercel.app").replace(/\/$/, "");
export const indexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "1";
