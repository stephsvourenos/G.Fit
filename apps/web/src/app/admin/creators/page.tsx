import { formatMoney } from "@app/domain";
import { contracts } from "@app/mock-data";
import { Badge, PageHeader, Table } from "@/components/AdminShell";
import { creatorBalances } from "@/lib/finance";

export default function CreatorsPage() {
  const rows = creatorBalances();
  return (
    <>
      <PageHeader title="Creators & contracts" sub="Each contract change creates a new version. Referral terms are frozen per referred household at sign-up, so changing a rate only affects future referrals." />
      <Table head={["Creator", "Contract", "Licence", "Referral terms", "Payee", "Earned (final)", "Paid", "Owed"]}>
        {rows.map(({ creator: c, final, paid }) => {
          const versions = contracts.filter((k) => k.creatorId === c.id).sort((a, b) => b.version - a.version);
          const k = versions[0]!;
          return (
            <tr key={c.id} className="align-top">
              <td className="px-4 py-3">
                <div className="font-semibold">{c.displayName}</div>
                <div className="text-xs text-ink/50">{c.legalName}</div>
                {c.isMinor && <Badge tone="amber">guardian-managed</Badge>}
              </td>
              <td className="px-4 py-3 text-xs">{k.contractId} v{k.version}{versions.length > 1 && <div className="text-ink/50">{versions.length - 1} earlier version(s)</div>}</td>
              <td className="px-4 py-3 text-xs">
                {k.licenceStartMonth} → {k.licenceEndMonth ?? "ongoing"}
                {k.royaltyPauses.map((p) => <div key={p.fromMonth}><Badge tone="amber">paused {p.fromMonth}</Badge></div>)}
                {c.status === "ended" && <div><Badge tone="grey">licence ended</Badge></div>}
              </td>
              <td className="px-4 py-3 text-xs">
                {k.referral.rateBps / 100}% for {k.referral.maxPaidMonths} paid months
                <div className="text-ink/50">new referrals {k.referral.acceptNewUntilMonth ? `until ${k.referral.acceptNewUntilMonth}` : "open"}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                {c.bankOnFile ? <Badge tone="green">bank on file</Badge> : <Badge tone="red">bank missing — hold</Badge>}
                <div className="mt-1 text-ink/50">{c.taxInfo}</div>
              </td>
              <td className="px-4 py-3">{formatMoney(final)}</td>
              <td className="px-4 py-3">{formatMoney(paid)}</td>
              <td className="px-4 py-3 font-semibold">{formatMoney(final - paid)}</td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-4 text-xs text-ink/50">Bank details are stored encrypted, shown masked, and can only be changed through a verified request with a second-person check (Phase 5).</p>
    </>
  );
}
