-- Founder pricing (A$9.99/month, locked in) and promo codes.
-- Founder offer is controlled by admins: open/closed, optional closing date and maximum number of founding families.
create table if not exists public.pricing_settings (
  id int primary key default 1 check (id = 1),
  founder_open boolean not null default true,
  founder_closes_at timestamptz,
  founder_limit int check (founder_limit is null or founder_limit > 0),
  founder_code text not null default 'FOUNDER' check (founder_code ~ '^[A-Z0-9]{3,20}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.pricing_settings (id) values (1) on conflict do nothing;
alter table public.pricing_settings enable row level security;
create policy pricing_settings_read on public.pricing_settings for select using (private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy pricing_settings_write on public.pricing_settings for update using (private.has_staff_role('{admin}'::public.staff_role[]))
  with check (private.has_staff_role('{admin}'::public.staff_role[]));
revoke insert, delete on public.pricing_settings from anon, authenticated;

-- What the family pays now, shown on their account page (kept in step with Stripe by the webhook).
alter table public.entitlements add column if not exists plan_key text;
alter table public.entitlements add column if not exists price_minor int;
alter table public.entitlements add column if not exists discounted_price_minor int;
alter table public.entitlements add column if not exists discount_label text;
alter table public.entitlements add column if not exists discount_ends_at timestamptz;

-- Audit changes to the founder offer.
create or replace function private.pricing_settings_audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'pricing', 'Founder offer changed',
          jsonb_build_object('open', new.founder_open, 'closes_at', new.founder_closes_at, 'limit', new.founder_limit, 'code', new.founder_code));
  return new;
end $$;
drop trigger if exists pricing_settings_audit on public.pricing_settings;
create trigger pricing_settings_audit before update on public.pricing_settings
  for each row execute function private.pricing_settings_audit();

-- ---------- Member emails ----------
-- member_notices is the outbox: every email we owe a family, queued by billing events (each at most once).
-- The send-emails function renders and sends them. Until an email service is connected, emails are
-- rendered and kept here ("logged") so they can be read in Admin → Member emails.
alter table public.member_notices add column if not exists status text not null default 'queued'
  check (status in ('queued', 'sent', 'logged', 'failed', 'skipped'));
alter table public.member_notices add column if not exists attempts int not null default 0;
alter table public.member_notices add column if not exists last_error text;
alter table public.member_notices add column if not exists to_email text;
alter table public.member_notices add column if not exists subject text;
alter table public.member_notices add column if not exists body_text text;
alter table public.member_notices add column if not exists body_html text;
alter table public.member_notices add column if not exists provider_message_id text;
create index if not exists member_notices_queue on public.member_notices (status, due_at) where status = 'queued';

-- (Staff and the family itself can already read notices — policy member_notices_read.)

select cron.schedule('send-emails', '*/10 * * * *', $$ select net.http_post(
       url := 'https://iwwnexttdqksrwqafazi.supabase.co/functions/v1/send-emails',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-nonce', private.issue_cron_nonce()),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     ) $$);
