"use client";

import { hasStreamingAccess } from "@app/domain";
import { ParentGate } from "@/components/ParentGate";
import { useHousehold } from "@/lib/household";

export default function AccountPage() {
  const h = useHousehold();
  const active = hasStreamingAccess(h.entitlement, new Date());
  return (
    <ParentGate title="Family account">
      <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Membership</div>
            <div className="font-display mt-1 text-2xl">Family monthly · A$14.99</div>
            <div className="text-sm text-muted">{active ? "Renews on 26 Nov 2026 · Visa ending 4242 (test)" : "Ended — videos paused"}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-mint/15 text-mint" : "bg-coral/20 text-coral-2"}`}>{active ? "Active" : "Inactive"}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-full bg-paper px-5 py-2.5 font-semibold text-ink" title="Opens Stripe’s Customer Portal in Phase 3">Manage membership & invoices ↗</button>
        </div>
        <p className="mt-3 text-xs text-muted">Plan changes, cancellation, card updates and invoices are handled on Stripe’s secure Customer Portal (Phase 3). Even when a membership ends, this page stays available.</p>
      </section>

      <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your data</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20">Download household data</button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20">Change parent PIN</button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold text-coral-2 ring-1 ring-coral/40">Delete account</button>
        </div>
        <p className="mt-3 text-xs text-muted">Buttons are placeholders until Phase 1 (accounts) — the flows are specified in the build plan.</p>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-sun/40 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-sun">Prototype test switch</div>
        <p className="mt-1 text-sm text-muted">Simulate an expired membership to see video access being blocked.</p>
        <button onClick={() => h.setSubscriptionActive(!active)} className="mt-3 rounded-full bg-sun px-4 py-2 text-sm font-semibold text-ink">
          {active ? "Simulate expired membership" : "Restore active membership"}
        </button>
      </section>
    </ParentGate>
  );
}
