"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, MockNotice } from "@/components/AuthCard";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  if (sentTo) {
    return (
      <AuthCard title="Check your email" sub={`We sent a confirmation link to ${sentTo}.`}>
        <p className="text-ink/75">
          Open the link on this device to finish setting up your account. It can take a minute to arrive — check your
          spam folder if you can’t see it.
        </p>
        <p className="mt-4 text-sm text-ink/60">Already confirmed? <Link href="/account/sign-in/" className="font-semibold underline">Sign in</Link></p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your G.Fit account"
      sub="Start with your own profile. You can add the people you live with later if you like, and children never need their own email."
      footer={<>Already have an account? <Link href="/account/sign-in/" className="font-semibold underline">Sign in</Link></>}
    >
      {!supabaseConfigured ? (
        <MockNotice />
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 10) return setError("Please choose a password of at least 10 characters.");
            setBusy(true);
            setError(undefined);
            const { data, error } = await supabase().auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: `${window.location.origin}/watch/` },
            });
            setBusy(false);
            if (error) return setError(friendlyError(error));
            // Supabase returns a user with no identities when the email is already registered.
            if (data.user && data.user.identities?.length === 0) {
              return setError("There’s already an account with that email. Try signing in instead.");
            }
            if (data.session) router.push("/watch/"); // email confirmation switched off
            else setSentTo(email.trim());
          }}
        >
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field id="password" label="Password" type="password" autoComplete="new-password" required minLength={10} placeholder="At least 10 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="flex gap-2 text-sm text-ink/75">
            <input id="adult" type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>I’m 18 or older.</span>
          </label>
          <label className="flex gap-2 text-sm text-ink/75">
            <input id="agree" type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link href="/legal/terms/" className="underline">Terms</Link> and <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>.</span>
          </label>
          <FormError message={error} />
          <button disabled={busy} className="w-full rounded-full bg-coral py-3 font-semibold text-white hover:bg-coral-2 disabled:opacity-60">
            {busy ? "Creating account…" : "Create account"}
          </button>
          <p className="text-xs text-ink/50">Next you’ll create your profile, then start your free trial on Stripe’s secure checkout.</p>
        </form>
      )}
    </AuthCard>
  );
}
