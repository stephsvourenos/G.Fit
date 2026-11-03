"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, MockNotice } from "@/components/AuthCard";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <AuthCard
      title="Welcome back"
      sub="Sign in with the household account (the parent who set it up)."
      footer={<>New here? <Link href="/account/sign-up/" className="font-semibold underline">Create a household account</Link></>}
    >
      {!supabaseConfigured ? (
        <MockNotice />
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
            setBusy(false);
            if (error) return setError(friendlyError(error));
            router.push("/watch/");
          }}
        >
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormError message={error} />
          <button disabled={busy} className="w-full rounded-full bg-coral py-3 font-semibold text-white hover:bg-coral-2 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-sm"><Link href="/account/forgot/" className="text-ink/70 underline">Forgot your password?</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
