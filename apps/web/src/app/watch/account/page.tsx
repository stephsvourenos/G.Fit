"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { hasStreamingAccess } from "@app/domain";
import { MembershipCard } from "@/components/MembershipCard";
import { ParentGate } from "@/components/ParentGate";
import { useHousehold } from "@/lib/household";

export default function AccountPage() {
  const h = useHousehold();
  const router = useRouter();
  const active = hasStreamingAccess(h.entitlement, new Date());
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [exported, setExported] = useState<string>();

  return (
    <ParentGate title="Family account">
      {h.mode === "live" && (
        <p className="mt-2 text-sm text-muted">Signed in as {h.email}</p>
      )}

      {h.mode === "live" ? (
        <MembershipCard entitlement={h.entitlement} />
      ) : (
        <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Membership
              </div>
              {h.mode === "mock" ? (
                <>
                  <div className="font-display mt-1 text-2xl">
                    Family monthly · A$14.99
                  </div>
                  <div className="text-sm text-muted">
                    {active
                      ? "Renews on 26 Nov 2026 · Visa ending 4242 (test)"
                      : "Ended — videos paused"}
                  </div>
                </>
              ) : null}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-mint/15 text-mint" : "bg-coral/20 text-coral-2"}`}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          Parent PIN
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[0-9]{4}$/.test(newPin))
              return setPinMsg("Use exactly 4 digits.");
            const r = await h.setPin(newPin);
            setPinMsg(r.ok ? "PIN updated." : r.message);
            if (r.ok) setNewPin("");
          }}
        >
          <label className="text-sm">
            New 4-digit PIN
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className="mt-1 block w-40 rounded-xl bg-ink-3 px-3 py-2 tracking-[0.4em]"
            />
          </label>
          <button className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20">
            Change PIN
          </button>
          {pinMsg && (
            <span className="text-sm text-muted" role="status">
              {pinMsg}
            </span>
          )}
        </form>
      </section>

      <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          Your data
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {h.exportData && (
            <button
              onClick={async () => {
                try {
                  const data = await h.exportData!();
                  setExported(JSON.stringify(data, null, 2));
                } catch (e) {
                  setMsg(String((e as Error).message));
                }
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20"
            >
              Show my household data
            </button>
          )}
          {h.mode === "live" && (
            <button
              onClick={() => h.signOut().then(() => router.push("/"))}
              className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20"
            >
              Sign out
            </button>
          )}
          {h.closeAccount && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-coral-2 ring-1 ring-coral/40"
            >
              Close account
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="mt-4 rounded-xl border border-coral/40 p-4 text-sm">
            <p>
              This permanently closes your account: your login, every profile,
              all progress, favourites and history, and your PIN. It can’t be
              undone. If you’d like a copy of your data, use “Show my household
              data” first.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={async () => {
                  const r = await h.closeAccount!();
                  if (r.ok) router.push("/");
                  else setMsg(r.message);
                }}
                className="rounded-full bg-coral px-4 py-2 font-semibold text-white"
              >
                Close account permanently
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {msg && (
          <p role="alert" className="mt-3 text-sm text-coral-2">
            {msg}
          </p>
        )}
        {exported && (
          <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-ink p-3 text-xs text-paper/80">
            {exported}
          </pre>
        )}
        {h.mode === "mock" && (
          <p className="mt-3 text-xs text-muted">
            Demo mode: these work once real accounts are switched on.
          </p>
        )}
      </section>

      {h.setSubscriptionActive && (
        <section className="mt-6 rounded-2xl border border-dashed border-sun/40 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-sun">
            Prototype test switch
          </div>
          <p className="mt-1 text-sm text-muted">
            Simulate an expired membership to see video access being blocked.
          </p>
          <button
            onClick={() => h.setSubscriptionActive!(!active)}
            className="mt-3 rounded-full bg-sun px-4 py-2 text-sm font-semibold text-ink"
          >
            {active
              ? "Simulate expired membership"
              : "Restore active membership"}
          </button>
        </section>
      )}
    </ParentGate>
  );
}
