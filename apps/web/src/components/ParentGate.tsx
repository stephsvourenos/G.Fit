"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHousehold } from "@/lib/household";
import { Logo } from "./SiteChrome";

/** Screens only a parent may open (profile management, billing). */
export function ParentGate({ title, children }: { title: string; children: React.ReactNode }) {
  const h = useHousehold();
  const router = useRouter();
  useEffect(() => {
    if (h.ready && !h.pinUnlocked) router.replace("/watch/");
  }, [h.ready, h.pinUnlocked, router]);
  if (!h.ready || !h.pinUnlocked) return <div className="flex-1" />;
  return (
    <div className="flex-1">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo dark />
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-mint/15 px-3 py-1 font-semibold text-mint">Parent mode</span>
            <Link href="/watch/" onClick={() => h.lockPin()} className="text-muted hover:text-paper">Lock & exit</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}
