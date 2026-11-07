-- One free trial per household and per card (card fingerprint from Stripe, not the card number).
create table if not exists public.trial_claims (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  card_fingerprint text,
  subscription_id text not null unique,
  trial_end timestamptz,
  outcome text not null default 'granted',   -- granted | refused-card-reused | refused-household-reused
  created_at timestamptz not null default now()
);
create index if not exists trial_claims_household on public.trial_claims(household_id);
create index if not exists trial_claims_fingerprint on public.trial_claims(card_fingerprint);

-- Messages we owe a family (e.g. "your free trial ends on …"). Sent by the email service (Phase 6);
-- kept as a compliance record of what was due and when it went out.
create table if not exists public.member_notices (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  due_at timestamptz not null,
  sent_at timestamptz,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Royalties (Phase 4) only count paid viewing.
alter table public.playback_sessions add column if not exists membership_status text;
alter table public.playback_sessions add column if not exists membership_provider text;

alter table public.trial_claims enable row level security;
alter table public.member_notices enable row level security;
create policy trial_claims_staff_read on public.trial_claims for select
  using (private.has_staff_role('{admin,finance,support}'::public.staff_role[]));
create policy member_notices_read on public.member_notices for select
  using (household_id = private.my_household_id() or private.has_staff_role('{admin,support}'::public.staff_role[]));
revoke insert, update, delete on public.trial_claims, public.member_notices from anon, authenticated;
