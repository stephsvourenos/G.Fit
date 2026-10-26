"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasStreamingAccess } from "@app/domain";
import { useHousehold } from "@/lib/household";
import { Avatar } from "./Avatar";
import { Logo } from "./SiteChrome";

/** Header + guards for screens that need a selected profile. */
export function WatchShell({ children }: { children: React.ReactNode }) {
  const h = useHousehold();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (h.ready && !h.activeProfile) router.replace("/watch/");
    if (h.ready && h.activeProfile?.pinProtected && !h.pinUnlocked) router.replace("/watch/");
  }, [h.ready, h.activeProfile, h.pinUnlocked, router]);

  if (!h.ready || !h.activeProfile) return <div className="flex-1" />;

  const access = hasStreamingAccess(h.entitlement, new Date());
  const nav = [
    ["/watch/home/", "Home"],
    ["/watch/search/", "Search"],
    ["/watch/me/", "My progress"],
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Logo dark />
          <nav className="ml-2 hidden gap-1 sm:flex">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${path === href ? "bg-white/10 text-paper" : "text-muted hover:text-paper"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/watch/" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 ring-white/10 hover:ring-white/30" title="Switch profile">
              <Avatar p={h.activeProfile} size={30} />
              <span className="text-sm font-semibold">{h.activeProfile.nickname}</span>
            </Link>
          </div>
        </div>
        <nav className="flex justify-around border-t border-white/5 sm:hidden">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={`flex-1 py-2 text-center text-xs font-semibold ${path === href ? "text-sun" : "text-muted"}`}>{label}</Link>
          ))}
        </nav>
      </header>
      {!access && (
        <div className="bg-coral px-4 py-3 text-center text-sm font-semibold text-white">
          Your membership has ended, so videos are paused. A parent can renew in{" "}
          <Link href="/watch/account/" className="underline">Family account</Link>.
        </div>
      )}
      <div className="flex-1">{children}</div>
    </>
  );
}
