alter table public.entitlements add column if not exists cancel_at_period_end boolean not null default false;
comment on column public.entitlements.cancel_at_period_end is 'Stripe: the family has cancelled; access continues until current_period_end, then ends.';
