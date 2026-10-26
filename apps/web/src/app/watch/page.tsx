"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AGE_BAND_LABEL, type Profile } from "@app/domain";
import { Avatar } from "@/components/Avatar";
import { PinPad } from "@/components/PinPad";
import { Logo } from "@/components/SiteChrome";
import { useHousehold } from "@/lib/household";

export default function ProfilePicker() {
  const h = useHousehold();
  const router = useRouter();
  const [pending, setPending] = useState<{ profile?: Profile; goTo: string } | null>(null);

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
        <p className="mt-2 text-muted">Demo household · 5 profiles</p>
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
        </p>
      </section>

      {pending && (
        <PinPad
          title={pending.profile ? `Open ${pending.profile.nickname}’s profile` : "Parents only"}
          onCancel={() => setPending(null)}
          onSubmit={(pin) => {
            if (!h.unlockWithPin(pin)) return false;
            if (pending.profile) h.selectProfile(pending.profile.id);
            const to = pending.goTo;
            setPending(null);
            router.push(to);
            return true;
          }}
        />
      )}
    </main>
  );
}
