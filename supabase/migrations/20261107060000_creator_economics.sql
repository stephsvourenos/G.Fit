-- Phase 4 — creator economics on real data.
-- Money is integer cents. Final month-end results, statements and ledger entries are
-- append-only; provisional (preview) runs can be re-run as often as needed.

-- Creator payout details (accountant to confirm GST / withholding treatment before launch).
alter table public.creators add column if not exists abn text;
alter table public.creators add column if not exists gst_registered boolean not null default false;
alter table public.creators add column if not exists withholding_note text;
alter table public.creators add column if not exists payee_name text;           -- guardian's name for minors

-- Referral terms are frozen at the moment of attribution (later contract changes never affect them).
alter table public.referral_attributions add column if not exists contract_id text;
alter table public.referral_attributions add column if not exists contract_version int;
alter table public.referral_attributions add column if not exists terms jsonb;
alter table public.referral_attributions add column if not exists source text not null default 'link';

-- Referral funnel: link clicks (anonymous visitor id from the browser, no personal data).
create table if not exists public.referral_clicks (
  id bigint generated always as identity primary key,
  referral_code text not null,
  visitor_id text not null,
  day date not null default (now() at time zone 'Australia/Sydney')::date,
  created_at timestamptz not null default now(),
  unique (referral_code, visitor_id, day)
);
alter table public.trial_claims add column if not exists referral_code text;

-- Stripe processing fee per invoice (creators are paid on net receipts: excl. GST and fees).
alter table public.billing_invoices add column if not exists processor_fee_minor integer;

-- Month-end runs. Provisional = preview (replaceable). Final = permanent, one per month.
create table if not exists public.month_end_runs (
  run_id text primary key,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status public.run_status not null,
  policy_versions jsonb not null,
  net_receipts_minor bigint not null,
  royalty_pool_minor bigint not null,
  royalty_allocated_minor bigint not null,
  royalty_retained_minor bigint not null,
  referral_minor bigint not null,
  adjustments_minor bigint not null,
  entry_count int not null,
  fingerprint text not null,
  input_counts jsonb not null default '{}'::jsonb,
  preview jsonb,                         -- provisional only: entries + statements to review
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists month_end_one_final on public.month_end_runs(month) where status = 'final';

-- Final monthly statement per creator (immutable).
create table if not exists public.creator_statements (
  creator_id uuid not null references public.creators(id),
  month text not null,
  run_id text not null references public.month_end_runs(run_id),
  opening_balance_minor bigint not null,
  royalties_minor bigint not null,
  referrals_minor bigint not null,
  adjustments_minor bigint not null,
  paid_out_minor bigint not null,
  closing_balance_minor bigint not null,
  payable_minor bigint not null,          -- due and above the minimum payout
  carried_forward_minor bigint not null,  -- below minimum or not yet due
  next_pay_date date,
  created_at timestamptz not null default now(),
  primary key (creator_id, month)
);

-- Payouts. Each ledger entry can be in at most ONE batch (primary key) — no payout runs twice.
create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','approved','exported','confirmed','failed','cancelled')),
  total_minor bigint not null,
  currency text not null default 'AUD',
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  exported_at timestamptz,
  confirmation jsonb,                     -- bank reference + confirmed amount (proof)
  confirmed_by uuid,
  confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.payout_items (
  batch_id uuid not null references public.payout_batches(id),
  creator_id uuid not null references public.creators(id),
  amount_minor bigint not null check (amount_minor > 0),
  primary key (batch_id, creator_id)
);
create table if not exists public.payout_item_entries (
  entry_id text primary key references public.ledger_entries(id),
  batch_id uuid not null references public.payout_batches(id),
  creator_id uuid not null
);

-- ---------- immutability ----------
create or replace function private.month_end_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status = 'provisional' then return old; end if;
  raise exception 'Final month-end runs cannot be changed or deleted' using errcode = 'insufficient_privilege';
end $$;
drop trigger if exists month_end_runs_guard on public.month_end_runs;
create trigger month_end_runs_guard before update or delete on public.month_end_runs
  for each row execute function private.month_end_guard();
drop trigger if exists statements_append_only on public.creator_statements;
create trigger statements_append_only before update or delete on public.creator_statements
  for each row execute function private.forbid_modification();
drop trigger if exists payout_items_append_only on public.payout_items;
create trigger payout_items_append_only before update or delete on public.payout_items
  for each row execute function private.forbid_modification();

-- A paid (confirmed) entry can never be released; entries of a cancelled/failed batch can.
create or replace function private.payout_entry_guard() returns trigger language plpgsql set search_path = '' as $$
declare st text;
begin
  select status into st from public.payout_batches where id = old.batch_id;
  if tg_op = 'DELETE' and st in ('cancelled','failed') then return old; end if;
  raise exception 'Ledger entries in an active or paid payout batch cannot be released' using errcode = 'insufficient_privilege';
end $$;
drop trigger if exists payout_entries_guard on public.payout_item_entries;
create trigger payout_entries_guard before update or delete on public.payout_item_entries
  for each row execute function private.payout_entry_guard();

-- ---------- row-level security ----------
alter table public.referral_clicks enable row level security;
alter table public.month_end_runs enable row level security;
alter table public.creator_statements enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_item_entries enable row level security;

create policy referral_clicks_read on public.referral_clicks for select using (
  private.has_staff_role('{admin,finance}'::public.staff_role[])
  or exists (select 1 from public.creators c where c.referral_code = referral_clicks.referral_code and private.is_creator_user(c.id)));
create policy month_end_runs_read on public.month_end_runs for select using (private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy creator_statements_read on public.creator_statements for select using (
  private.has_staff_role('{admin,finance}'::public.staff_role[]) or private.is_creator_user(creator_id));
create policy payout_batches_read on public.payout_batches for select using (private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy payout_items_read on public.payout_items for select using (
  private.has_staff_role('{admin,finance}'::public.staff_role[]) or private.is_creator_user(creator_id));
create policy payout_item_entries_read on public.payout_item_entries for select using (
  private.has_staff_role('{admin,finance}'::public.staff_role[]) or private.is_creator_user(creator_id));
-- Creators may see their own attribution count (no household detail is exposed beyond an id).
create policy referral_attributions_creator_read on public.referral_attributions for select using (private.is_creator_user(creator_id));

revoke insert, update, delete on public.referral_clicks, public.month_end_runs, public.creator_statements,
  public.payout_batches, public.payout_items, public.payout_item_entries from anon, authenticated;

-- ---------- functions ----------
-- Count a referral link visit (once per visitor per code per day). Callable by anyone.
create or replace function public.record_referral_click(code text, visitor text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if code !~ '^[A-Za-z0-9_-]{3,32}$' or visitor !~ '^[A-Za-z0-9-]{8,64}$' then return false; end if;
  if not exists (select 1 from public.creators c where c.referral_code = code and c.status = 'active') then return false; end if;
  insert into public.referral_clicks (referral_code, visitor_id) values (code, visitor) on conflict do nothing;
  return true;
end $$;
revoke all on function public.record_referral_click(text, text) from public;
grant execute on function public.record_referral_click(text, text) to anon, authenticated;

-- Write a FINAL month-end in one transaction: run + ledger entries + statements. Server only.
create or replace function public.finalise_month_end(p_run jsonb, p_entries jsonb, p_statements jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare m text := p_run->>'month';
begin
  if exists (select 1 from public.month_end_runs where month = m and status = 'final') then
    raise exception 'Month % is already final', m;
  end if;
  if exists (select 1 from public.month_end_runs where month > m and status = 'final') then
    raise exception 'A later month is already final — months must be finalised in order';
  end if;
  delete from public.month_end_runs where month = m and status = 'provisional';
  insert into public.month_end_runs (run_id, month, status, policy_versions, net_receipts_minor, royalty_pool_minor,
      royalty_allocated_minor, royalty_retained_minor, referral_minor, adjustments_minor, entry_count, fingerprint,
      input_counts, created_by)
  values (p_run->>'run_id', m, 'final', p_run->'policy_versions', (p_run->>'net_receipts_minor')::bigint,
      (p_run->>'royalty_pool_minor')::bigint, (p_run->>'royalty_allocated_minor')::bigint,
      (p_run->>'royalty_retained_minor')::bigint, (p_run->>'referral_minor')::bigint, (p_run->>'adjustments_minor')::bigint,
      (p_run->>'entry_count')::int, p_run->>'fingerprint', coalesce(p_run->'input_counts', '{}'::jsonb), p_run->>'created_by');
  insert into public.ledger_entries (id, creator_id, kind, amount_minor, currency, earning_month, run_id, run_status,
      source_refs, contract_ref, memo, reverses_entry_id, created_at)
  select e->>'id', (e->>'creator_id')::uuid, (e->>'kind')::public.ledger_kind, (e->>'amount_minor')::bigint, e->>'currency',
      e->>'earning_month', p_run->>'run_id', 'final', array(select jsonb_array_elements_text(e->'source_refs')),
      e->>'contract_ref', e->>'memo', e->>'reverses_entry_id', now()
  from jsonb_array_elements(p_entries) e;
  insert into public.creator_statements (creator_id, month, run_id, opening_balance_minor, royalties_minor, referrals_minor,
      adjustments_minor, paid_out_minor, closing_balance_minor, payable_minor, carried_forward_minor, next_pay_date)
  select (s->>'creator_id')::uuid, m, p_run->>'run_id', (s->>'opening_balance_minor')::bigint, (s->>'royalties_minor')::bigint,
      (s->>'referrals_minor')::bigint, (s->>'adjustments_minor')::bigint, (s->>'paid_out_minor')::bigint,
      (s->>'closing_balance_minor')::bigint, (s->>'payable_minor')::bigint, (s->>'carried_forward_minor')::bigint,
      nullif(s->>'next_pay_date','')::date
  from jsonb_array_elements(p_statements) s;
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values (nullif(p_run->>'created_by_id','')::uuid, p_run->>'created_by', 'finance', format('Finalised month-end %s', m),
          jsonb_build_object('run_id', p_run->>'run_id', 'fingerprint', p_run->>'fingerprint', 'entries', jsonb_array_length(p_entries)));
  return p_run->>'run_id';
end $$;
revoke all on function public.finalise_month_end(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finalise_month_end(jsonb, jsonb, jsonb) to service_role;

-- Create a payout batch from items worked out by the server (domain rules). Server only.
create or replace function public.create_payout_batch(p_items jsonb, p_created_by uuid, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare bid uuid; it jsonb; total bigint := 0; s bigint;
begin
  if jsonb_array_length(p_items) = 0 then raise exception 'Nothing is payable'; end if;
  insert into public.payout_batches (total_minor, created_by, note) values (0, p_created_by, p_note) returning id into bid;
  for it in select * from jsonb_array_elements(p_items) loop
    -- every entry must be FINAL, belong to this creator, and sum to the item amount
    select coalesce(sum(l.amount_minor), 0) into s from public.ledger_entries l
      where l.id in (select jsonb_array_elements_text(it->'entry_ids')) and l.creator_id = (it->>'creator_id')::uuid and l.run_status = 'final';
    if s <> (it->>'amount_minor')::bigint then raise exception 'Payout amount does not match its ledger entries'; end if;
    insert into public.payout_items (batch_id, creator_id, amount_minor) values (bid, (it->>'creator_id')::uuid, s);
    -- primary key on entry_id makes paying any entry twice impossible
    insert into public.payout_item_entries (entry_id, batch_id, creator_id)
      select jsonb_array_elements_text(it->'entry_ids'), bid, (it->>'creator_id')::uuid;
    total := total + s;
  end loop;
  update public.payout_batches set total_minor = total where id = bid;
  insert into public.audit_log (actor_user_id, area, action, detail)
  values (p_created_by, 'finance', 'Created payout batch', jsonb_build_object('batch', bid, 'total_minor', total));
  return bid;
end $$;
revoke all on function public.create_payout_batch(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.create_payout_batch(jsonb, uuid, text) to service_role;

-- Status changes: maker/checker approval, export, and confirmation that REQUIRES bank proof.
create or replace function public.payout_batch_action(p_batch uuid, p_action text, p_bank_reference text default null,
    p_confirmed_total bigint default null, p_reason text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare b public.payout_batches; me uuid := (select auth.uid());
begin
  if not private.has_staff_role('{admin,finance}') then raise exception 'Finance staff only' using errcode = 'insufficient_privilege'; end if;
  select * into b from public.payout_batches where id = p_batch for update;
  if b.id is null then raise exception 'No such batch'; end if;
  if p_action = 'approve' then
    if b.status <> 'draft' then raise exception 'Only a draft batch can be approved'; end if;
    if b.created_by = me then raise exception 'A different person must approve (maker/checker)'; end if;
    update public.payout_batches set status = 'approved', approved_by = me, approved_at = now() where id = p_batch;
  elsif p_action = 'export' then
    if b.status <> 'approved' then raise exception 'Only an approved batch can be exported'; end if;
    update public.payout_batches set status = 'exported', exported_at = now() where id = p_batch;
  elsif p_action = 'confirm' then
    if b.status <> 'exported' then raise exception 'Only an exported batch can be confirmed as paid'; end if;
    if coalesce(trim(p_bank_reference), '') = '' then raise exception 'Bank reference (proof of payment) is required'; end if;
    if p_confirmed_total is distinct from b.total_minor then
      raise exception 'Confirmed amount % does not match the batch total %', p_confirmed_total, b.total_minor;
    end if;
    update public.payout_batches set status = 'confirmed', confirmed_by = me, confirmed_at = now(),
      confirmation = jsonb_build_object('bank_reference', p_bank_reference, 'confirmed_total_minor', p_confirmed_total) where id = p_batch;
  elsif p_action in ('cancel', 'fail') then
    if b.status in ('confirmed', 'cancelled', 'failed') then raise exception 'This batch can no longer be changed'; end if;
    if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
    update public.payout_batches set status = case when p_action = 'cancel' then 'cancelled' else 'failed' end,
      note = coalesce(note || ' | ', '') || p_reason where id = p_batch;
    delete from public.payout_item_entries where batch_id = p_batch;   -- entries become payable again
  else
    raise exception 'Unknown action';
  end if;
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values (me, (select auth.jwt()) ->> 'email', 'finance', format('Payout batch %s', p_action),
          jsonb_build_object('batch', p_batch, 'reference', p_bank_reference, 'reason', p_reason));
  return p_action;
end $$;
revoke all on function public.payout_batch_action(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.payout_batch_action(uuid, text, text, bigint, text) to authenticated;
