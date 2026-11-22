import type { MetadataRoute } from "next";
import { getCatalogue } from "@/lib/public-catalogue";
import { siteUrl } from "@/lib/site";

const STATIC = ["", "workouts", "programmes", "instructors", "everyone", "pricing", "join", "support", "about", "teach", "contact", "legal/privacy", "legal/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { workouts, instructors } = await getCatalogue();
  const page = (p: string, lastModified?: string) => ({ url: `${siteUrl}/${p}${p ? "/" : ""}`, ...(lastModified ? { lastModified } : {}) });
  return [
    ...STATIC.map((p) => page(p)),
    ...workouts.map((w) => page(`workouts/${w.slug}`, w.publishedAt)),
    ...instructors.map((i) => page(`instructors/${i.slug}`)),
  ];
}
