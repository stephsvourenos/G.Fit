"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/SiteChrome";

const liveAccounts = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export const NAV = [
  { href: "/workouts/", label: "Workouts" },
  { href: "/programmes/", label: "Programmes" },
  { href: "/instructors/", label: "Instructors" },
  { href: "/everyone/", label: "For everyone" },
  { href: "/pricing/", label: "Pricing" },
  { href: "/teach/", label: "Teach on G.Fit" },
];

export function SiteHeader() {
  const path = usePathname() ?? "/";
  // The menu belongs to the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const active = (href: string) => path === href || path.startsWith(href) || path === href.replace(/\/$/, "");

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 text-paper backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-5 px-4 sm:px-6">
        <Logo dark />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-bold lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={active(n.href) ? "text-coral-2" : "text-paper/80 hover:text-paper"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={liveAccounts ? "/account/sign-in/" : "/watch/"} className="hidden rounded-full px-4 py-2 text-sm font-bold ring-1 ring-white/25 hover:ring-white/60 sm:inline-block">
            Sign in
          </Link>
          <Link href="/join/" className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-gum-hover">Get started</Link>
          <button type="button" onClick={() => setOpenOn(open ? null : path)} aria-expanded={open} aria-controls="mobile-nav"
            className="rounded-xl px-3 py-2 ring-1 ring-white/20 lg:hidden" aria-label={open ? "Close menu" : "Open menu"}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-white/10 bg-ink px-4 pb-5 pt-2 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`block py-3 text-lg font-bold ${active(n.href) ? "text-coral-2" : "text-paper"}`}>{n.label}</Link>
          ))}
          <Link href={liveAccounts ? "/account/sign-in/" : "/watch/"} className="mt-2 block py-3 text-lg font-bold text-paper/80">Sign in</Link>
        </nav>
      )}
    </header>
  );
}
