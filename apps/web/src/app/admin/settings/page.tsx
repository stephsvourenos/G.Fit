import { DEFAULT_NET_RECEIPTS_POLICY, DEFAULT_PAYOUT_TERMS, DEFAULT_PLAYBACK_POLICY, DEFAULT_REFERRAL_TERMS, DEFAULT_ROYALTY_POLICY } from "@app/domain";
import { brand } from "@app/config";
import { PageHeader } from "@/components/AdminShell";

export default function SettingsPage() {
  const blocks: Array<[string, unknown]> = [
    ["Brand", { name: brand.name, currency: brand.defaultCurrency, country: brand.defaultCountry }],
    ["Net receipts policy", DEFAULT_NET_RECEIPTS_POLICY],
    ["Royalty pool policy", DEFAULT_ROYALTY_POLICY],
    ["Default referral terms", DEFAULT_REFERRAL_TERMS],
    ["Default payout terms", DEFAULT_PAYOUT_TERMS],
    ["Qualified playback policy", DEFAULT_PLAYBACK_POLICY],
  ];
  return (
    <>
      <PageHeader title="Configuration" sub="Business rules are versioned data, not code. A change creates a new version that applies from a chosen date; past months keep the version they were calculated with." />
      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map(([t, v]) => (
          <section key={t} className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
            <h2 className="font-semibold">{t}</h2>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-ink/70">{JSON.stringify(v, null, 2)}</pre>
          </section>
        ))}
      </div>
    </>
  );
}
