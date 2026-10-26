import type { NextConfig } from "next";

/**
 * PREVIEW_EXPORT=1 builds a fully static copy of the prototype (mock data
 * only) that can be opened without a server — used for shareable previews.
 * Normal builds keep server features for webhooks, auth and signed playback.
 */
const previewExport = process.env.PREVIEW_EXPORT === "1";

const nextConfig: NextConfig = {
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
