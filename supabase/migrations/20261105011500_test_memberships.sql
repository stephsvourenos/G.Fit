-- Admin-only: give a household a free membership (testing, creators, support goodwill).
-- Recorded as provider 'manual_grant' so it is never mistaken for a paid subscription
-- and never counts towards creator royalties.
create or replace function public.admin_grant_membership(owner_email text, days int default 30)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare hid uuid; until timestamptz := now() + make_interval(days => greatest(1, least(days, 366)));
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
    set provider = 'manual_grant', status = 'active', current_period_end = excluded.current_period_end,
        grace_days = 0, updated_at = now()
    where public.entitlements.provider = 'manual_grant'; -- never overwrite a real paid subscription
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'access',
          format('Granted %s-day test membership', days), jsonb_build_object('household_id', hid, 'until', until));
  return until;
end;
$$;
revoke execute on function public.admin_grant_membership(text, int) from public, anon;
grant execute on function public.admin_grant_membership(text, int) to authenticated;
