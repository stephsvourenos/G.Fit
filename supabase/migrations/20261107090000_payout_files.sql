-- Phase 5 — bank payment files and reconciliation.

-- Where each creator (or their guardian) is paid. Creators manage their own; finance reads.
create table if not exists public.creator_bank_accounts (
  creator_id uuid primary key references public.creators(id),
  account_name text not null check (length(trim(account_name)) between 1 and 32),
  bsb text not null check (bsb ~ '^\d{3}-\d{3}$'),
  account_number text not null check (account_number ~ '^\d{1,9}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.creator_bank_accounts enable row level security;
create policy bank_read on public.creator_bank_accounts for select using (
  private.is_creator_user(creator_id) or private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy bank_insert on public.creator_bank_accounts for insert with check (
  private.is_creator_user(creator_id) or private.has_staff_role('{admin}'::public.staff_role[]));
create policy bank_update on public.creator_bank_accounts for update using (
  private.is_creator_user(creator_id) or private.has_staff_role('{admin}'::public.staff_role[]))
  with check (private.is_creator_user(creator_id) or private.has_staff_role('{admin}'::public.staff_role[]));
revoke delete on public.creator_bank_accounts from anon, authenticated;

-- Every change is audited (number masked) — changing bank details is how payments get redirected.
create or replace function private.bank_account_audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'finance',
          case when tg_op = 'INSERT' then 'Creator bank details added' else 'Creator bank details CHANGED' end,
          jsonb_build_object('creator_id', new.creator_id, 'bsb', new.bsb,
                             'account', '****' || right(new.account_number, 3), 'name', new.account_name));
  return new;
end $$;
drop trigger if exists bank_account_audit on public.creator_bank_accounts;
create trigger bank_account_audit before insert or update on public.creator_bank_accounts
  for each row execute function private.bank_account_audit();

-- Your business's direct-entry details (from your bank). Not secret, but admin-only to change.
create table if not exists public.finance_settings (
  id int primary key default 1 check (id = 1),
  bank_code text check (bank_code ~ '^[A-Z]{3}$'),
  de_user_name text,
  de_user_id text check (de_user_id ~ '^\d{6}$'),
  bsb text check (bsb ~ '^\d{3}-\d{3}$'),
  account_number text check (account_number ~ '^\d{1,9}$'),
  account_title text,
  remitter_name text,
  self_balancing boolean not null default false,
  balancing_debit_code text not null default '13',
  video_cost_per_1000_min_minor int not null default 0,   -- for contribution margin
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.finance_settings (id) values (1) on conflict do nothing;
alter table public.finance_settings enable row level security;
create policy finance_settings_read on public.finance_settings for select using (private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy finance_settings_write on public.finance_settings for update using (private.has_staff_role('{admin}'::public.staff_role[]))
  with check (private.has_staff_role('{admin}'::public.staff_role[]));
revoke insert, delete on public.finance_settings from anon, authenticated;

-- Bank file + reconciliation kept on the batch.
alter table public.payout_batches add column if not exists aba_text text;
alter table public.payout_batches add column if not exists aba_sha256 text;
alter table public.payout_batches add column if not exists processing_date date;
alter table public.payout_batches add column if not exists reconciliation jsonb;

-- The server records the generated file and marks the batch exported in one step (approved → exported).
create or replace function public.payout_record_export(p_batch uuid, p_aba text, p_sha256 text, p_processing_date date, p_by uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.payout_batches;
begin
  select * into b from public.payout_batches where id = p_batch for update;
  if b.id is null then raise exception 'No such batch'; end if;
  if b.status <> 'approved' then raise exception 'Only an approved batch can be exported (status: %)', b.status; end if;
  update public.payout_batches set status = 'exported', exported_at = now(), aba_text = p_aba, aba_sha256 = p_sha256,
    processing_date = p_processing_date where id = p_batch;
  insert into public.audit_log (actor_user_id, area, action, detail)
  values (p_by, 'finance', 'Generated bank payment file', jsonb_build_object('batch', p_batch, 'sha256', p_sha256, 'date', p_processing_date));
end $$;
revoke all on function public.payout_record_export(uuid, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.payout_record_export(uuid, text, text, date, uuid) to service_role;

-- Manual "export" now requires the bank file to exist (it is created by payout_record_export).
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
    if b.aba_text is null then raise exception 'Create the bank payment file first'; end if;
    update public.payout_batches set status = 'exported', exported_at = now() where id = p_batch;
  elsif p_action = 'confirm' then
    if b.status <> 'exported' then raise exception 'Only an exported batch can be confirmed as paid'; end if;
    if coalesce(trim(p_bank_reference), '') = '' then raise exception 'Bank reference (proof of payment) is required'; end if;
    if p_confirmed_total is distinct from b.total_minor then
      raise exception 'Confirmed amount % does not match the batch total %', p_confirmed_total, b.total_minor;
    end if;
    update public.payout_batches set status = 'confirmed', confirmed_by = me, confirmed_at = now(),
      confirmation = jsonb_build_object('bank_reference', p_bank_reference, 'confirmed_total_minor', p_confirmed_total,
        'reconciled', coalesce((b.reconciliation ->> 'all_matched')::boolean, false)) where id = p_batch;
  elsif p_action in ('cancel', 'fail') then
    if b.status in ('confirmed', 'cancelled', 'failed') then raise exception 'This batch can no longer be changed'; end if;
    if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
    update public.payout_batches set status = case when p_action = 'cancel' then 'cancelled' else 'failed' end,
      note = coalesce(note || ' | ', '') || p_reason where id = p_batch;
    delete from public.payout_item_entries where batch_id = p_batch;
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
