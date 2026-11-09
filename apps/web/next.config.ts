import type { NextConfig } from "next";

/**
 * PREVIEW_EXPORT=1 builds a fully static copy of the prototype (mock data
 * only) that can be opened without a server — used for shareable previews.
 * Normal builds keep server features for webhooks, auth and signed playback.
 */
const previewExport = process.env.PREVIEW_EXPORT === "1";

/**
 * Browser security rules for every page (security review, 9 Nov 2026):
 * - the site can't be put inside another site's frame (stops click-jacking),
 * - the browser only loads scripts, video and data from us, Supabase, Mux (video) and Stripe,
 * - camera/microphone/location are switched off, and HTTPS is enforced.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.mux.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mux.com https://*.litix.io",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  ...(previewExport ? {} : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
  transpilePackages: ["@app/domain", "@app/mock-data", "@app/config"],
  ...(previewExport ? { output: "export" as const, trailingSlash: true } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
