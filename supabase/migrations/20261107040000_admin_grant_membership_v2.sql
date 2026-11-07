-- Test grants may replace an ended/unpaid Stripe membership (never an active paid one),
-- and now raise an error instead of silently doing nothing.
create or replace function public.admin_grant_membership(owner_email text, days integer default 30)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare hid uuid; until timestamptz := now() + make_interval(days => greatest(1, least(days, 366))); n int;
begin
  if not private.has_staff_role('{admin}') then
    raise exception 'Only admins can grant memberships' using errcode = 'insufficient_privilege';
  end if;
  select h.id into hid from public.households h join auth.users u on u.id = h.owner_user_id
    where lower(u.email) = lower(owner_email);
  if hid is null then raise exception 'No household found for %', owner_email; end if;
  insert into public.entitlements (household_id, provider, provider_subscription_id, status, current_period_end, grace_days)
  values (hid, 'manual_grant', 'grant_' || replace(gen_random_uuid()::text, '-', ''), 'active', until, 0)
  on conflict (household_id) do update
    set provider = 'manual_grant', provider_customer_id = null, provider_subscription_id = excluded.provider_subscription_id,
        status = 'active', current_period_end = excluded.current_period_end, grace_days = 0,
        cancel_at_period_end = false, updated_at = now()
    where public.entitlements.provider = 'manual_grant'
       or public.entitlements.status not in ('active', 'trialing', 'past_due')
       or public.entitlements.current_period_end < now();
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'This household has an active paid membership — a test grant would overwrite it';
  end if;
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'access',
          format('Granted %s-day test membership', days), jsonb_build_object('household_id', hid, 'until', until));
  return until;
end;
$function$;
