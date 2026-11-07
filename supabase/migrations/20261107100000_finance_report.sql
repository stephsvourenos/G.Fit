-- Phase 5 — finance reports for admin/finance staff: subscriber KPIs, trial conversion, monthly cash,
-- contribution margin and cohort retention. Read-only; everything in AUD cents; months are Sydney months.
create or replace function public.finance_report(p_months int default 12)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := 'Australia/Sydney';
  first_m date := (date_trunc('month', now() at time zone tz) - make_interval(months => greatest(1, least(p_months, 36)) - 1))::date;
  video_cost int;
  out jsonb;
begin
  if not private.has_staff_role('{admin,finance}') then
    raise exception 'Finance staff only' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(video_cost_per_1000_min_minor, 0) into video_cost from public.finance_settings where id = 1;

  with
  months as (
    select to_char(m, 'YYYY-MM') as month, m::date as m_start, (m + interval '1 month')::date as m_end
    from generate_series(first_m, date_trunc('month', now() at time zone tz)::date, interval '1 month') m
  ),
  paid as (   -- real money in (zero-value trial invoices excluded)
    select i.*, to_char(coalesce(i.paid_at, i.updated_at) at time zone tz, 'YYYY-MM') as paid_month
    from public.billing_invoices i where i.status = 'paid' and i.amount_paid_minor > 0
  ),
  -- latest paid invoice per active subscription → monthly recurring revenue (ex GST)
  latest as (
    select distinct on (p.subscription_id) p.subscription_id, p.household_id, p.billing_interval,
      (p.amount_paid_minor - p.gst_minor) as ex_gst
    from paid p where p.billing_reason in ('subscription_create', 'subscription_cycle', 'subscription_update')
    order by p.subscription_id, p.period_start desc nulls last
  ),
  ents as (select * from public.entitlements where provider = 'stripe'),
  mrr as (
    select coalesce(sum(case when l.billing_interval = 'year' then round(l.ex_gst / 12.0) else l.ex_gst end), 0)::bigint as mrr,
           count(*) as paying
    from ents e join latest l on l.subscription_id = e.provider_subscription_id
    where e.status in ('active', 'past_due') and e.current_period_end > now()
  ),
  trials as (
    select t.*, exists (select 1 from paid p where p.subscription_id = t.subscription_id) as converted
    from public.trial_claims t where t.outcome = 'granted'
  ),
  first_paid as (select household_id, min(to_char(period_start at time zone tz, 'YYYY-MM')) as cohort from paid group by 1),
  covered as (   -- months each household had paid cover (an annual invoice covers 12)
    select distinct p.household_id, mo.month
    from paid p join months mo on p.period_start < mo.m_end and coalesce(p.period_end, p.period_start + interval '1 month') > mo.m_start
  ),
  refunds as (
    select to_char(created_at at time zone tz, 'YYYY-MM') as month, sum(amount_minor) as amt
    from public.billing_refunds where status = 'succeeded' group by 1
  ),
  runs as (   -- recognised net receipts (annual plans spread over 12 months) from the month-end run
    select distinct on (month) month, net_receipts_minor, status,
      royalty_allocated_minor + referral_minor + adjustments_minor as creator_cost from public.month_end_runs
    order by month, case status when 'final' then 0 else 1 end
  ),
  minutes as (select month, sum(credited_sec) / 60.0 as mins from public.qualified_views group by 1),
  series as (
    select mo.month,
      coalesce((select sum(amount_paid_minor) from paid where paid_month = mo.month), 0) as gross,
      coalesce((select sum(gst_minor) from paid where paid_month = mo.month), 0) as gst,
      coalesce((select sum(coalesce(processor_fee_minor, 0)) from paid where paid_month = mo.month), 0) as fees,
      coalesce((select amt from refunds r where r.month = mo.month), 0) as refunds,
      (select count(*) from first_paid f where f.cohort = mo.month) as new_paying,
      (select count(*) from ents e where e.status in ('canceled', 'unpaid', 'incomplete_expired')
         and to_char(e.current_period_end at time zone tz, 'YYYY-MM') = mo.month) as churned,
      (select count(distinct household_id) from covered c where c.month = mo.month) as paying_households,
      (select r.net_receipts_minor from runs r where r.month = mo.month) as recognised_net,
      (select r.status from runs r where r.month = mo.month) as run_status,
      coalesce((select r.creator_cost from runs r where r.month = mo.month), 0) as creator_cost,
      round(coalesce((select mins from minutes m where m.month = mo.month), 0) * video_cost / 1000.0)::bigint as video_cost,
      round(coalesce((select mins from minutes m where m.month = mo.month), 0))::bigint as qualified_minutes
    from months mo
  ),
  cohorts as (
    select f.cohort, count(*) as size
    from first_paid f where f.cohort >= to_char(first_m, 'YYYY-MM') group by 1
  )
  select jsonb_build_object(
    'generated_at', now(),
    'test_mode', not exists (select 1 from public.billing_invoices where livemode),
    'snapshot', jsonb_build_object(
      'active', (select count(*) from ents where status = 'active' and not coalesce(cancel_at_period_end, false) and current_period_end > now()),
      'cancelling', (select count(*) from ents where status in ('active', 'trialing') and coalesce(cancel_at_period_end, false) and current_period_end > now()),
      'trialing', (select count(*) from ents where status = 'trialing' and current_period_end > now()),
      'past_due', (select count(*) from ents where status in ('past_due', 'unpaid')),
      'mrr_minor', (select mrr from mrr),
      'paying', (select paying from mrr),
      'arpu_minor', (select case when paying > 0 then round(mrr::numeric / paying) else 0 end from mrr)
    ),
    'trials', jsonb_build_object(
      'started', (select count(*) from trials),
      'converted', (select count(*) from trials where converted),
      'ended_without_paying', (select count(*) from trials where not converted and trial_end < now()),
      'in_progress', (select count(*) from trials where not converted and trial_end >= now()),
      'refused_reused_card', (select count(*) from public.trial_claims where outcome = 'refused-card-reused')
    ),
    'months', (select coalesce(jsonb_agg(jsonb_build_object(
        'month', s.month, 'gross_minor', s.gross, 'gst_minor', s.gst, 'fees_minor', s.fees, 'refunds_minor', s.refunds,
        'net_cash_minor', s.gross - s.gst - s.fees - s.refunds,
        'new_paying', s.new_paying, 'churned', s.churned, 'paying_households', s.paying_households,
        'recognised_net_minor', s.recognised_net, 'run_status', s.run_status,
        'creator_cost_minor', s.creator_cost, 'video_cost_minor', s.video_cost, 'qualified_minutes', s.qualified_minutes,
        'contribution_minor', case when s.recognised_net is null then null else s.recognised_net - s.creator_cost - s.video_cost end
      ) order by s.month), '[]'::jsonb) from series s),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object(
        'cohort', c.cohort, 'size', c.size,
        'retained', (select jsonb_agg(x.n order by x.month) from (
            select mo.month, (select count(*) from covered cv join first_paid f2 on f2.household_id = cv.household_id
                              where f2.cohort = c.cohort and cv.month = mo.month) as n
            from months mo where mo.month >= c.cohort) x)
      ) order by c.cohort), '[]'::jsonb) from cohorts c)
  ) into out;
  return out;
end $$;
revoke all on function public.finance_report(int) from public, anon;
grant execute on function public.finance_report(int) to authenticated;
