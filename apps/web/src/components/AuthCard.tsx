import Link from "next/link";
import { Logo } from "./SiteChrome";

/** Shared frame for sign-in / sign-up / password screens. */
export function AuthCard({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6"><Logo /></div>
      <div className="mx-auto w-full max-w-md px-4 pb-20 pt-4 sm:px-6">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-ink/10 sm:p-8">
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          {sub && <p className="mt-1 text-sm text-ink/60">{sub}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink/70">{footer}</div>}
        <p className="mt-6 text-center text-xs text-ink/45"><Link href="/" className="underline">Back to website</Link></p>
      </div>
    </main>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <input {...props} className="mt-1.5 w-full rounded-xl border border-ink/15 px-3 py-2.5 font-normal text-ink focus:border-ink/40 focus:outline-none" />
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-[#b8361a]">{message}</p>;
}

export function MockNotice() {
  return (
    <p className="rounded-xl bg-sun/25 px-3 py-2 text-sm text-ink">
      Real accounts aren’t switched on in this copy of the app (it’s running on sample data).{" "}
      <Link href="/watch/" className="font-semibold underline">Open the demo household</Link> instead.
    </p>
  );
}
