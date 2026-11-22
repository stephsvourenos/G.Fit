import Link from "next/link";
import { aud, brand, plans } from "@app/config";
import { Logo } from "@/components/SiteChrome";

const COLS: { h: string; links: [string, string][] }[] = [
  { h: "Explore", links: [["/workouts/", "Workouts"], ["/programmes/", "Programmes"], ["/instructors/", "Instructors"]] },
  { h: "Membership", links: [["/pricing/", "Pricing"], ["/everyone/", "Individuals & families"], ["/join/", "Get started"], ["/support/", "Help & FAQs"]] },
  { h: brand.name, links: [["/about/", "About"], ["/teach/", "Teach on G.Fit"], ["/contact/", "Contact"], ["/creator/", "Instructor sign-in"]] },
  { h: "Legal", links: [["/legal/privacy/", "Privacy"], ["/legal/terms/", "Terms"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink text-paper">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Logo dark />
            <p className="mt-4 max-w-xs text-sm text-muted">{brand.tagline}<br />{brand.promise}</p>
          </div>
          {COLS.map((c) => (
            <div key={c.h}>
              <h2 className="text-sm font-bold">{c.h}</h2>
              <ul className="mt-4 grid gap-2.5 text-sm text-muted">
                {c.links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-paper">{label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          © {new Date().getFullYear()} {brand.name}. Made in Australia. Membership {aud(plans.monthly.amount)} a month or {aud(plans.annual.amount)} a year,
          in Australian dollars including GST.
        </p>
      </div>
    </footer>
  );
}
