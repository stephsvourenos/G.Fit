import Link from "next/link";
import { brand } from "@app/config";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-xl font-semibold ${dark ? "text-paper" : "text-ink"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral text-white">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M4 15c2.5-6 5.5-6 8 0s5.5 6 8 0" />
        </svg>
      </span>
      {brand.name}
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Logo />
      <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-4">
        <Link href="/#pricing" className="hidden px-2 text-ink/70 hover:text-ink sm:inline">Pricing</Link>
        <Link href="/creator/" className="hidden px-2 text-ink/70 hover:text-ink sm:inline">Creators</Link>
        <Link href="/admin/" className="hidden px-2 text-ink/70 hover:text-ink md:inline">Admin demo</Link>
        <Link href="/watch/" className="rounded-full px-4 py-2 text-ink ring-1 ring-ink/15 hover:ring-ink/40">Sign in</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <Logo dark />
          <p className="mt-3 max-w-xs">{brand.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link href="/legal/privacy/" className="hover:text-paper">Privacy</Link>
          <Link href="/legal/terms/" className="hover:text-paper">Terms</Link>
          <Link href="/support/" className="hover:text-paper">Support</Link>
          <Link href="/creator/" className="hover:text-paper">Creator portal</Link>
          <Link href="/admin/" className="hover:text-paper">Admin demo</Link>
          <Link href="/r/PIP/" className="hover:text-paper">Example referral link</Link>
        </div>
      </div>
    </footer>
  );
}
