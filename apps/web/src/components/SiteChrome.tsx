import Link from "next/link";
import { brand } from "@app/config";

const liveAccounts = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

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

export function SiteNav({ dark = false }: { dark?: boolean }) {
  const link = dark ? "text-paper/70 hover:text-paper" : "text-ink/70 hover:text-ink";
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Logo dark={dark} />
      <nav className="flex items-center gap-1 text-sm font-bold sm:gap-4">
        <Link href="/#pricing" className={`hidden px-2 sm:inline ${link}`}>Prices</Link>
        <Link href="/support/" className={`hidden px-2 sm:inline ${link}`}>Help</Link>
        <Link href={liveAccounts ? "/account/sign-in/" : "/watch/"} className={`rounded-full px-4 py-2 ring-1 ${dark ? "text-paper ring-white/25 hover:ring-white/60" : "text-ink ring-ink/15 hover:ring-ink/40"}`}>Sign in</Link>
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
          <p className="mt-6 text-xs">© {new Date().getFullYear()} {brand.name}. Made in Australia.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link href="/legal/privacy/" className="hover:text-paper">Privacy</Link>
          <Link href="/legal/terms/" className="hover:text-paper">Terms</Link>
          <Link href="/support/" className="hover:text-paper">Support</Link>
          <Link href="/creator/" className="hover:text-paper">Coach sign-in</Link>
          <Link href="/join/" className="hover:text-paper">Join</Link>
        </div>
      </div>
    </footer>
  );
}
