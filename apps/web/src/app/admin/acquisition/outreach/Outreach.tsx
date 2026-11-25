"use client";

import Link from "next/link";
import { useState } from "react";
import { Table } from "@/components/AdminShell";
import { CHANNEL_LABEL, db, fmtDate, useLoad, type Card } from "@/lib/crm";
import { Composer, Notice, inputCls } from "../_ui";

const CARD_COLS = "id, ref, creator_name, business_name, country, primary_category, allocation_category, primary_platform, fit_score, fit_tier, confidence_level, stage, last_contact_at, assigned_to, outbound_count, last_inbound_at, do_not_contact, instagram_url, tiktok_url, youtube_url, facebook_url, linkedin_url, website_url, contact_form_url, public_business_email, outreach_permission_status, personalised_initial_dm, personalised_initial_email, specific_personalisation_detail, recommended_pitch_angle, why_gfit_is_relevant, full_length_workouts_available, preferred_outreach_channel, unavailable_channels";

export function Outreach() {
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState<Card | null>(null);
  const [note, setNote] = useState<string>();
  const search = useLoad<Card[]>(async () => {
    if (q.trim().length < 2) return [];
    const s = q.trim().replace(/[%,()"]/g, " ");
    const { data, error } = await db().from("crm_prospects").select(CARD_COLS).or(`creator_name.ilike.%${s}%,business_name.ilike.%${s}%,key_instagram.ilike.%${s.replace(/^@/, "")}%`).eq("do_not_contact", false).limit(8);
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...(r as unknown as Card), followers: null, channel: (r as { preferred_outreach_channel: string | null }).preferred_outreach_channel }));
  }, [q]);
  const log = useLoad(async () => {
    const { data, error } = await db().from("crm_activities").select("id, kind, channel, sentiment, subject, body, occurred_at, actor_label, prospect_id, crm_prospects(creator_name), crm_templates(name)")
      .in("kind", ["outreach", "reply"]).order("occurred_at", { ascending: false }).limit(100);
    if (error) throw error;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data ?? []) as any[];
  });
  const stats = useLoad(async () => {
    const [sup, waiting] = await Promise.all([
      db().from("crm_suppressions").select("key_hash", { count: "exact", head: true }),
      db().from("crm_tasks").select("id", { count: "exact", head: true }).eq("status", "open").eq("kind", "follow_up"),
    ]);
    return { suppressed: sup.count ?? 0, waiting: waiting.count ?? 0 };
  });

  return (
    <div className="space-y-6">
      {note && <Notice tone="ok" onClose={() => setNote(undefined)}>{note}</Notice>}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-ink/5 lg:col-span-2">
          <h2 className="font-display text-xl">Write to a creator</h2>
          <p className="mt-1 text-sm text-ink/60">Find a prospect, pick their prepared message or a template, review it, copy it, send it yourself on their platform — then confirm. The quickest way through a day is <Link className="underline" href="/admin/acquisition/today/">Today’s Tasks</Link>.</p>
          <input className={`${inputCls} mt-3`} placeholder="Search by name, business or @handle" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 divide-y divide-ink/5">
            {(search.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><b>{p.creator_name}</b> <span className="text-ink/50">{[p.primary_category, p.country].filter(Boolean).join(" · ")}</span></span>
                <button className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white" onClick={() => setComposing(p)}>Write…</button>
              </li>
            ))}
            {q.trim().length >= 2 && !search.loading && !search.data?.length && <li className="py-2 text-sm text-ink/55">No contactable prospects match.</li>}
          </ul>
        </div>
        <div className="space-y-3 rounded-xl bg-white p-5 text-sm ring-1 ring-ink/5">
          <h2 className="font-display text-xl">How outreach works here</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-ink/70">
            <li>G.Fit never sends social messages for you and doesn’t use bots, scraping or automation on Instagram, TikTok or LinkedIn.</li>
            <li>Opening a profile or copying a message logs nothing. Only “I’ve sent it” records the contact and schedules the follow-up.</li>
            <li>Recruitment emails need an address published for business enquiries (or the creator’s agreement), must say who they’re from, and must offer an easy opt-out.</li>
            <li>The same creator can’t be logged twice on the same channel within a few days, so nobody gets duplicate messages.</li>
            <li>Email sending from G.Fit isn’t connected yet, so emails open in your own email app. Bulk cold email isn’t offered.</li>
          </ul>
          <p className="text-ink/60">Do-not-contact list: <b>{stats.data?.suppressed ?? "…"}</b> profiles/addresses. Waiting on follow-ups: <b>{stats.data?.waiting ?? "…"}</b>.</p>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl">Recent messages and replies</h2>
        <Table head={["When", "Creator", "What", "Channel", "Template", "By"]}>
          {(log.data ?? []).map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDate(a.occurred_at, true)}</td>
              <td className="px-3 py-2"><Link className="font-semibold hover:underline" href={`/admin/acquisition/prospect/?id=${a.prospect_id}`}>{a.crm_prospects?.creator_name ?? "—"}</Link></td>
              <td className="max-w-md px-3 py-2 text-xs">{a.kind === "outreach" ? "Sent" : `Reply (${a.sentiment})`} — <span className="text-ink/60">{(a.subject ? `${a.subject}: ` : "") + (a.body ?? "").slice(0, 120)}</span></td>
              <td className="px-3 py-2 text-xs">{CHANNEL_LABEL[a.channel] ?? a.channel ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{a.crm_templates?.name ?? (a.kind === "outreach" ? "Prepared / own" : "")}</td>
              <td className="px-3 py-2 text-xs">{a.actor_label}</td>
            </tr>
          ))}
          {!log.loading && !log.data?.length && <tr><td colSpan={6} className="px-4 py-4 text-ink/55">No messages logged yet.</td></tr>}
        </Table>
      </section>
      {composing && <Composer prospect={composing} onClose={() => setComposing(null)} onSent={(m) => { setComposing(null); setNote(m); log.reload(); stats.reload(); }} />}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
