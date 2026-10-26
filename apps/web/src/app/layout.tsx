import type { Metadata, Viewport } from "next";
import { brand } from "@app/config";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${brand.name} — family fitness streaming`, template: `%s · ${brand.name}` },
  description: brand.tagline,
};

export const viewport: Viewport = { themeColor: "#0e1116" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PrototypeBanner />
        {children}
      </body>
    </html>
  );
}
