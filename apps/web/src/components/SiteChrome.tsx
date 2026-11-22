import Link from "next/link";
import { brand } from "@app/config";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-xl font-bold tracking-[-0.03em] ${dark ? "text-paper" : "text-ink"}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-coral text-white">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M4 15c2.5-6 5.5-6 8 0s5.5 6 8 0" />
        </svg>
      </span>
      {brand.name}
    </Link>
  );
}
