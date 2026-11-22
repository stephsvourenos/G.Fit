import type { MetadataRoute } from "next";
import { indexable, siteUrl } from "@/lib/site";

/** Public pages are crawlable in production; members' areas, admin and account screens never are. */
export default function robots(): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/watch/", "/admin/", "/creator/", "/account/", "/r/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
