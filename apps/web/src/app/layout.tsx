import type { Metadata, Viewport } from "next";
import { brand } from "@app/config";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import { ErrorReporter } from "@/components/ErrorReporter";
import { ReferralCapture } from "@/components/ReferralCapture";
import { indexable, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${brand.name} — ${brand.tagline.replace(/\.$/, "")}`, template: `%s · ${brand.name}` },
  description: `Fitness streaming with workouts from many instructors in one membership. ${brand.promise} Just for you, or for everyone at home.`,
  applicationName: brand.name,
  openGraph: { siteName: brand.name, locale: "en_AU", type: "website" },
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#15131c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PrototypeBanner />
        <ReferralCapture />
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
