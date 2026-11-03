"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AGE_BAND_LABEL, type Profile } from "@app/domain";
import { Avatar } from "@/components/Avatar";
import { PinPad } from "@/components/PinPad";
import { Logo } from "@/components/SiteChrome";
import { useHousehold } from "@/lib/household";

export default function ProfilePicker() {
  const h = useHousehold();
  const router = useRouter();
  const [pending, setPending] = useState<{ profile?: Profile; goTo: string } | null>(null);

  useEffect(() => {
    if (h.status === "signed-out") router.replace("/account/sign-in/");
  }, [h.status, router]);

  if (h.status === "loading" || h.status === "signed-out") {
    return <main className="grid flex-1 place-items-center text-muted">Loading your household…</main>;
  }
  if (h.status === "needs-pin") return <SetPinScreen />;

  function choose(p: Profile) {
    if (p.pinProtected && !h.pinUnlocked) {
      setPending({ profile: p, goTo: "/watch/home/" });
      return;
    }
    if (!p.pinProtected) h.lockPin(); // switching to a child profile re-locks adult areas
    h.selectProfile(p.id);
    router.push("/watch/home/");
  }

  function gated(goTo: string) {
    if (h.pinUnlocked) router.push(goTo);
    else setPending({ goTo });
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6"><Logo dark /></div>
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        <h1 className="font-display text-4xl sm:text-5xl">Who’s moving today?</h1>
        <p className="mt-2 text-muted">
          {h.mode === "mock" ? "Demo household · sample data" : h.email} · {h.profiles.length} profile{h.profiles.length === 1 ? "" : "s"}
        </p>
        {h.status === "needs-profiles" && (
          <div className="mt-8 max-w-md rounded-3xl bg-ink-2 p-6 ring-1 ring-white/10">
            <div className="font-display text-2xl">Add your family</div>
            <p className="mt-1 text-sm text-muted">Start with a profile for yourself, then one for each child. Children only need a nickname and age group.</p>
            <Link href="/watch/profiles/" className="mt-4 inline-block rounded-full bg-coral px-5 py-2.5 font-semibold text-white">Add profiles</Link>
          </div>
        )}
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
          {h.profiles.map((p) => (
            <button key={p.id} onClick={() => choose(p)} className="group flex flex-col items-center gap-3 rounded-3xl p-2">
              <div className="transition group-hover:-translate-y-1 group-hover:scale-105">
                <Avatar p={p} size={104} />
              </div>
              <div className="font-semibold">{p.nickname}</div>
              <div className="-mt-2 flex items-center gap-1 text-xs text-muted">
                {p.pinProtected && <span aria-label="PIN protected">🔒</span>}
                {AGE_BAND_LABEL[p.ageBand]}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <button onClick={() => gated("/watch/profiles/")} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:ring-white/50">
            Manage profiles 🔒
          </button>
          <button onClick={() => gated("/watch/account/")} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/20 hover:ring-white/50">
            Family account & billing 🔒
          </button>
        </div>
        <p className="mt-6 max-w-md text-xs text-muted">
          Adult profiles, profile management and billing need the parent PIN. Children can only open their own,
          age-appropriate profile. <Link href="/" className="underline">Back to website</Link>
          {h.mode === "live" && (
            <> · <button onClick={() => h.signOut().then(() => router.push("/"))} className="underline">Sign out</button></>
          )}
        </p>
      </section>

      {pending && (
        <PinPad
          title={pending.profile ? `Open ${pending.profile.nickname}’s profile` : "Parents only"}
          onCancel={() => setPending(null)}
          hint={h.mode === "mock" ? "demo: 1234" : undefined}
          onSubmit={async (pin) => {
            const res = await h.unlockWithPin(pin);
            if (!res.ok) return res;
            if (pending.profile) h.selectProfile(pending.profile.id);
            const to = pending.goTo;
            setPending(null);
            router.push(to);
            return res;
          }}
        />
      )}
    </main>
  );
}

/** First sign-in: the parent chooses the PIN that guards adult profiles and settings. */
function SetPinScreen() {
  const h = useHousehold();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6"><Logo dark /></div>
      <section className="mx-auto w-full max-w-md px-4 pb-20 pt-6">
        <h1 className="font-display text-4xl">Set your parent PIN</h1>
        <p className="mt-2 text-muted">
          You’ll use this 4-digit PIN to open adult profiles, manage profiles and change account settings. Don’t share it
          with your children. It’s stored scrambled and locks for 15 minutes after 5 wrong tries.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[0-9]{4}$/.test(pin)) return setError("Use exactly 4 digits.");
            if (pin !== again) return setError("The two PINs don’t match.");
            if (/^(\d)\1{3}$/.test(pin) || pin === "1234") return setError("Choose something harder to guess than " + pin + ".");
            setBusy(true);
            const res = await h.setPin(pin);
            setBusy(false);
            if (!res.ok) setError(res.message);
          }}
        >
          <label className="block text-sm font-semibold">New PIN
            <input id="pin" inputMode="numeric" autoComplete="off" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="mt-1.5 w-full rounded-xl bg-ink-3 px-3 py-3 text-2xl tracking-[0.5em]" />
          </label>
          <label className="block text-sm font-semibold">Type it again
            <input id="pin-again" inputMode="numeric" autoComplete="off" maxLength={4} type="password" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))} className="mt-1.5 w-full rounded-xl bg-ink-3 px-3 py-3 text-2xl tracking-[0.5em]" />
          </label>
          {error && <p role="alert" className="text-sm text-coral-2">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-coral py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save PIN"}</button>
        </form>
      </section>
    </main>
  );
}
