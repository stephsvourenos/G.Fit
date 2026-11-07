-- Phase 3 — Stripe billing (TEST MODE). Only the server (Edge Functions with the
-- service key) writes these tables; families read their own rows, finance/admin
-- staff read all. Amounts are integer cents, GST-inclusive (Australia).

-- One Stripe customer per household.
create table if not exists public.billing_customers (
  household_id uuid primary key references public.households(id) on delete cascade,
  stripe_customer_id text not null unique,
  livemode boolean not null default false,
  created_at timestamptz not null default now()
);

-- Snapshot of every Stripe invoice (the input to royalty and referral maths).
create table if not exists public.billing_invoices (
  id text primary key,                              -- Stripe invoice id (in_…)
  household_id uuid not null references public.households(id) on delete cascade,
  subscription_id text,
  status text not null,                              -- draft | open | paid | void | uncollectible
  currency text not null,
  amount_due_minor integer not null,
  amount_paid_minor integer not null,
  gst_minor integer not null,                        -- GST included in amount_paid (1/11)
  price_id text,
  price_lookup_key text,
  billing_interval text,                             -- month | year
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  billing_reason text,
  livemode boolean not null default false,
  hosted_invoice_url text,
  updated_at timestamptz not null default now()
);
create index if not exists billing_invoices_household on public.billing_invoices(household_id, paid_at);

-- Refunds (reverse royalties and referral commission later).
create table if not exists public.billing_refunds (
  id text primary key,                               -- Stripe refund id (re_…)
  household_id uuid not null references public.households(id) on delete cascade,
  invoice_id text references public.billing_invoices(id) on delete set null,
  charge_id text,
  amount_minor integer not null,
  status text not null,
  created_at timestamptz not null,
  livemode boolean not null default false
);

-- Which creator referred a household (decided once, on the first paid invoice).
create table if not exists public.referral_attributions (
  household_id uuid primary key references public.households(id) on delete cascade,
  creator_id uuid not null references public.creators(id),
  referral_code text not null,
  first_invoice_id text not null,
  attributed_at timestamptz not null default now()
);

alter table public.billing_events add column if not exists object_id text;
alter table public.billing_events add column if not exists outcome text;

alter table public.billing_customers enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_refunds enable row level security;
alter table public.referral_attributions enable row level security;

create policy billing_customers_read on public.billing_customers for select
  using (household_id = private.my_household_id() or private.has_staff_role('{admin,finance,support}'::public.staff_role[]));
create policy billing_invoices_read on public.billing_invoices for select
  using (household_id = private.my_household_id() or private.has_staff_role('{admin,finance,support}'::public.staff_role[]));
create policy billing_refunds_read on public.billing_refunds for select
  using (household_id = private.my_household_id() or private.has_staff_role('{admin,finance}'::public.staff_role[]));
create policy referral_attributions_read on public.referral_attributions for select
  using (private.has_staff_role('{admin,finance}'::public.staff_role[]));

-- No insert/update/delete policies: only the server key can write.
revoke insert, update, delete on public.billing_customers, public.billing_invoices, public.billing_refunds,
  public.referral_attributions from anon, authenticated;

-- Daily reconciliation with Stripe (same single-use code pattern as the playback job).
select cron.schedule(
  'billing-reconcile',
  '41 2 * * *',
  $$ select net.http_post(
       url := 'https://iwwnexttdqksrwqafazi.supabase.co/functions/v1/billing-reconcile',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-nonce', private.issue_cron_nonce()),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     ) $$
);
