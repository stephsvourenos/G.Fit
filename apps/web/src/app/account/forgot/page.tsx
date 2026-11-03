"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, Field, FormError, MockNotice } from "@/components/AuthCard";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  return (
    <AuthCard title="Reset your password" sub="We’ll email you a link to choose a new one." footer={<Link href="/account/sign-in/" className="underline">Back to sign in</Link>}>
      {!supabaseConfigured ? (
        <MockNotice />
      ) : sent ? (
        <p className="text-ink/75">If there’s an account for <b>{email}</b>, a reset link is on its way. Open it on this device.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/account/reset/`,
            });
            setBusy(false);
            if (error) return setError(friendlyError(error));
            setSent(true);
          }}
        >
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <button disabled={busy} className="w-full rounded-full bg-ink py-3 font-semibold text-paper disabled:opacity-60">{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
    </AuthCard>
  );
}
