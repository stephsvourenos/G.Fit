"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, Field, FormError, MockNotice } from "@/components/AuthCard";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

/** Landing page for the password-reset email link. */
export default function Reset() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!supabaseConfigured) return;
    const db = supabase();
    // The client swaps the code in the link for a short recovery session.
    const { data } = db.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    db.auth.getSession().then(({ data: d }) => d.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthCard title="Choose a new password">
      {!supabaseConfigured ? (
        <MockNotice />
      ) : !ready ? (
        <p className="text-ink/70">Checking your reset link… If nothing happens, request a new link — each one only works once.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 10) return setError("Please choose a password of at least 10 characters.");
            setBusy(true);
            const { error } = await supabase().auth.updateUser({ password });
            setBusy(false);
            if (error) return setError(friendlyError(error));
            router.push("/watch/");
          }}
        >
          <Field id="password" label="New password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormError message={error} />
          <button disabled={busy} className="w-full rounded-full bg-coral py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </AuthCard>
  );
}
