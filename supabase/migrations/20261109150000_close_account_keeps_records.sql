-- Closing an account (fix found during the Phase 6 security/privacy review, 9 Nov 2026).
--
-- Before: deleting the login cascaded through the household and deleted invoices, refunds, viewing totals and
-- trial claims — losing tax records, changing creator royalty inputs, and letting a family re-take the free trial.
-- The Stripe subscription was also left running.
--
-- Now: the login and everything personal (profiles, PIN, progress, favourites, emails we sent) are deleted. The
-- household row stays as an anonymous shell (no owner) so invoices, refunds, viewing totals, referral attribution
-- and trial claims keep their meaning. The Stripe subscription is cancelled first by the close-account function.

alter table public.households add column if not exists closed_at timestamptz;
alter table public.households alter column owner_user_id drop not null;
alter table public.households drop constraint if exists households_owner_user_id_fkey;
alter table public.households add constraint households_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete set null;

-- Viewing records outlive the profile that made them (needed for royalty statements); the link just goes blank.
alter table public.playback_sessions alter column profile_id drop not null;
alter table public.playback_sessions drop constraint if exists playback_sessions_profile_id_fkey;
alter table public.playback_sessions add constraint playback_sessions_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;
alter table public.qualified_views alter column profile_id drop not null;
alter table public.qualified_views drop constraint if exists qualified_views_profile_id_fkey;
alter table public.qualified_views add constraint qualified_views_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- The shared closing step (no checks here — callers check).
create or replace function private.close_account(p_uid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  select id into hid from public.households where owner_user_id = p_uid;
  if hid is not null then
    delete from public.profiles where household_id = hid;           -- progress, favourites, completions cascade
    delete from public.household_pins where household_id = hid;
    delete from public.member_notices where household_id = hid;      -- these contain the email address
    update public.households set closed_at = now() where id = hid;
  end if;
  insert into public.audit_log (actor_user_id, area, action, detail)
    values (null, 'accounts', 'account closed by owner', jsonb_build_object('household', hid, 'closed_at', now()));
  delete from auth.users where id = p_uid;                           -- households.owner_user_id becomes null
  return hid;
end $$;
revoke all on function private.close_account(uuid) from public, anon, authenticated;

-- Called by a signed-in parent. Refuses while a paid membership is still running: the website uses the
-- close-account server function instead, which cancels the subscription first.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Not signed in' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.staff_members where user_id = uid)
     or exists (select 1 from public.creator_users where user_id = uid) then
    raise exception 'Staff and creator accounts are closed by an administrator' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.entitlements e join public.households h on h.id = e.household_id
             where h.owner_user_id = uid and e.provider in ('stripe', 'apple_iap', 'google_play')
               and e.status in ('active', 'trialing', 'past_due', 'unpaid')) then
    raise exception 'Your membership is still active. Cancel it first (Manage membership), then close the account.';
  end if;
  perform private.close_account(uid);
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Used by the close-account server function after it has cancelled the Stripe subscription.
create or replace function public.close_account_for(p_uid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.staff_members where user_id = p_uid)
     or exists (select 1 from public.creator_users where user_id = p_uid) then
    raise exception 'Staff and creator accounts are closed by an administrator';
  end if;
  return private.close_account(p_uid);
end $$;
revoke all on function public.close_account_for(uuid) from public, anon, authenticated;
grant execute on function public.close_account_for(uuid) to service_role;

-- Tests (always rolled back): select tests.run_account_closing_checks();
create or replace function tests.run_account_closing_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  hid uuid; hid2 uuid; pid uuid; n int; passed int := 0; failed text := '';
begin
  insert into auth.users (id, email, aud, role) values (u, 'close1@test.invalid', 'authenticated', 'authenticated'),
                                                       (u2, 'close2@test.invalid', 'authenticated', 'authenticated');
  insert into public.households (owner_user_id) values (u) returning id into hid;
  insert into public.households (owner_user_id) values (u2) returning id into hid2;
  insert into public.profiles (household_id, nickname, avatar_emoji, avatar_colour, age_band) values (hid, 'Kid', '🐣', '#FFC23D', 'under-6') returning id into pid;
  insert into public.billing_invoices (id, household_id, status, currency, amount_due_minor, amount_paid_minor, gst_minor, livemode)
    values ('in_test_close', hid, 'paid', 'aud', 1499, 1499, 136, false);
  insert into public.trial_claims (household_id, card_fingerprint, subscription_id, outcome) values (hid, 'fp_test_close', 'sub_test_close', 'granted');
  insert into public.entitlements (household_id, provider, provider_subscription_id, status, current_period_end) values (hid2, 'stripe', 'sub_test_close2', 'active', now() + interval '20 days');

  -- Family 2 has a running Stripe membership: closing directly is refused (must cancel first / use close-account).
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.delete_my_account(); failed := failed || ' [closed while membership still running]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- Family 1 closes.
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.delete_my_account();
  perform set_config('role', me, true);
  select count(*) into n from auth.users where id = u;                 if n = 0 then passed := passed + 1; else failed := failed || ' [login deleted]'; end if;
  select count(*) into n from public.profiles where household_id = hid; if n = 0 then passed := passed + 1; else failed := failed || ' [profiles deleted]'; end if;
  select count(*) into n from public.households where id = hid and owner_user_id is null and closed_at is not null;
                                                                       if n = 1 then passed := passed + 1; else failed := failed || ' [household kept anonymous + closed]'; end if;
  select count(*) into n from public.billing_invoices where id = 'in_test_close';
                                                                       if n = 1 then passed := passed + 1; else failed := failed || ' [invoice kept for tax]'; end if;
  select count(*) into n from public.trial_claims where card_fingerprint = 'fp_test_close';
                                                                       if n = 1 then passed := passed + 1; else failed := failed || ' [trial claim kept (no repeat trial)]'; end if;
  -- Nobody can see the closed shell.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.households where id = hid;       if n = 0 then passed := passed + 1; else failed := failed || ' [closed household invisible to others]'; end if;
  perform set_config('role', me, true);
  -- The service path works for a running membership (after Stripe cancel).
  perform public.close_account_for(u2);
  select count(*) into n from auth.users where id = u2;                if n = 0 then passed := passed + 1; else failed := failed || ' [server close works]'; end if;

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % ACCOUNT-CLOSING CHECKS PASSED', passed;
end $fn$;
revoke all on function tests.run_account_closing_checks() from public, anon, authenticated;
