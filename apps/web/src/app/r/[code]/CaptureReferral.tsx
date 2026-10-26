"use client";

import Link from "next/link";
import { useEffect } from "react";
import { load, save } from "@/lib/storage";

/**
 * Stores the referral touch in first-party storage so it survives the trip
 * through checkout. In Phase 4 it's also recorded server-side (click count,
 * anonymous visitor ID) and passed to Stripe Checkout as metadata.
 */
export function CaptureReferral({ code }: { code: string }) {
  useEffect(() => {
    const visitorId = load<string>("pf.visitor", "") || `v_${Math.random().toString(36).slice(2, 10)}`;
    save("pf.visitor", visitorId);
    save("pf.referral", { code, at: new Date().toISOString(), visitorId });
  }, [code]);
  return (
    <div className="mt-8">
      <Link href="/join/" className="inline-block rounded-full bg-coral px-7 py-3.5 font-semibold text-white hover:bg-coral-2">Start your family membership</Link>
      <p className="mt-3 text-xs text-ink/50">Referral code <b>{code}</b> saved for 30 days on this device.</p>
    </div>
  );
}
