-- Content pipeline (Phase 6): captions are made automatically by Mux when a video is uploaded, and a workout
-- can't go live without captions (launch default: everything captioned).
alter table public.workouts add column if not exists caption_status text not null default 'none'
  check (caption_status in ('none', 'generating', 'ready', 'errored'));

create or replace function private.workouts_publish_gate()
returns trigger language plpgsql set search_path = '' as $$
declare minor boolean; going_live boolean;
begin
  if new.state in ('published','scheduled') then
    select i.is_minor into minor from public.instructors i where i.id = new.instructor_id;
    if not new.rights_creator_licence_signed then raise exception 'Cannot publish: creator licence not signed'; end if;
    if not new.rights_music_cleared then raise exception 'Cannot publish: music rights not cleared'; end if;
    if not new.rights_safety_reviewed then raise exception 'Cannot publish: safety review not completed'; end if;
    if minor and coalesce(new.rights_guardian_consent, false) = false then
      raise exception 'Cannot publish: guardian consent missing for a minor instructor';
    end if;
    if cardinality(new.territories) = 0 then raise exception 'Cannot publish: no licensed territories'; end if;
    -- New rule, checked when staff move a workout live (already-live workouts can still be edited; the website
    -- always creates workouts as drafts).
    if tg_op = 'INSERT' and current_user = 'authenticated' then
      raise exception 'New workouts start as drafts';
    end if;
    going_live := tg_op = 'UPDATE' and old.state not in ('published', 'scheduled');
    if going_live and not new.captions then raise exception 'Cannot publish: no captions yet'; end if;
    if going_live and new.mux_playback_id is null then raise exception 'Cannot publish: the video isn’t uploaded and ready yet'; end if;
    if new.state = 'published' and new.published_at is null then new.published_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Security test suite updated for the new rule (adds: publishing without video and captions is refused).
create or replace function tests.run_rls_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  ua uuid := gen_random_uuid();   -- parent A
  ub uuid := gen_random_uuid();   -- parent B
  uc uuid := gen_random_uuid();   -- creator C login
  ud uuid := gen_random_uuid();   -- content editor
  us uuid := gen_random_uuid();   -- support staff
  ha uuid; hb uuid; pa_child uuid; pb_child uuid;
  cr_c uuid; cr_other uuid; ins_c uuid; w_pub uuid; w_draft uuid;
  n int; ok boolean; passed int := 0; failed text := '';

begin
  -- ---------- fixtures (as database owner) ----------
  insert into auth.users (id, email, aud, role) values
    (ua, 'a@test.invalid', 'authenticated', 'authenticated'),
    (ub, 'b@test.invalid', 'authenticated', 'authenticated'),
    (uc, 'c@test.invalid', 'authenticated', 'authenticated'),
    (ud, 'd@test.invalid', 'authenticated', 'authenticated'),
    (us, 's@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_members (user_id, role) values (ud, 'content_editor'), (us, 'support');
  insert into public.households (owner_user_id) values (ua) returning id into ha;
  insert into public.households (owner_user_id) values (ub) returning id into hb;
  insert into public.profiles (household_id, nickname, age_band) values (ha, 'Kid A', '6-8') returning id into pa_child;
  insert into public.profiles (household_id, nickname, age_band) values (hb, 'Kid B', '9-12') returning id into pb_child;
  insert into public.creators (display_name, legal_name, referral_code) values ('Coach C', 'C Pty Ltd', 'CEE') returning id into cr_c;
  insert into public.creators (display_name, legal_name, referral_code) values ('Coach Z', 'Z Pty Ltd', 'ZED') returning id into cr_other;
  insert into public.creator_users (creator_id, user_id) values (cr_c, uc);
  insert into public.instructors (creator_id, display_name) values (cr_c, 'Coach C') returning id into ins_c;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state,
    rights_creator_licence_signed, rights_music_cleared, rights_safety_reviewed)
    values ('t-pub', 'Published', ins_c, cr_c, 'dance', 300, 'gentle', '{6-8}', 'published', true, true, true) returning id into w_pub;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state)
    values ('t-draft', 'Draft', ins_c, cr_c, 'dance', 300, 'gentle', '{6-8}', 'draft') returning id into w_draft;
  insert into public.completions (profile_id, workout_id) values (pa_child, w_pub), (pb_child, w_pub);
  insert into public.ledger_entries (id, creator_id, kind, amount_minor, earning_month, run_id, run_status, contract_ref)
    values ('t-l1', cr_c, 'royalty', 392, '2026-10', 'r', 'final', 'ct'), ('t-l2', cr_other, 'royalty', 500, '2026-10', 'r', 'final', 'ct');

  -- ---------- as parent A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.households;           if n = 1 then passed := passed + 1; else failed := failed || ' [A sees only own household]'; end if;
  select count(*) into n from public.profiles;             if n = 1 then passed := passed + 1; else failed := failed || ' [A sees only own profiles]'; end if;
  select count(*) into n from public.completions;          if n = 1 then passed := passed + 1; else failed := failed || ' [A sees only own activity]'; end if;
  select count(*) into n from public.workouts where slug like 't-%';             if n = 1 then passed := passed + 1; else failed := failed || ' [members see published only]'; end if;
  select count(*) into n from public.creators;             if n = 0 then passed := passed + 1; else failed := failed || ' [members cannot read creator records]'; end if;
  select count(*) into n from public.ledger_entries;       if n = 0 then passed := passed + 1; else failed := failed || ' [members cannot read ledger]'; end if;
  select count(*) into n from public.household_pins;       if n = 0 then passed := passed + 1; else failed := failed || ' [PIN hashes unreadable]'; end if;

  begin insert into public.profiles (household_id, nickname, age_band) values (hb, 'Sneaky', 'adult');
        failed := failed || ' [A cannot add profile to B]';
  exception when others then passed := passed + 1; end;

  begin insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands)
          values ('x', 'x', ins_c, cr_c, 'dance', 60, 'gentle', '{adult}');
        failed := failed || ' [members cannot create content]';
  exception when others then passed := passed + 1; end;

  begin insert into public.entitlements (household_id, provider, provider_subscription_id, status, current_period_end)
          values (ha, 'mock', 'sub_free', 'active', now() + interval '10 years');
        failed := failed || ' [members cannot grant themselves access]';
  exception when others then passed := passed + 1; end;

  begin update public.households set max_profiles = 10 where id = ha;
        failed := failed || ' [owner cannot raise profile cap]';
  exception when others then passed := passed + 1; end;

  update public.profiles set nickname = 'Hacked' where id = pb_child;
  get diagnostics n = row_count;                            if n = 0 then passed := passed + 1; else failed := failed || ' [A cannot edit B profile]'; end if;

  insert into public.profiles (household_id, nickname, age_band, pin_protected) values (ha, 'Parent', 'adult', false);
  select count(*) into n from public.profiles where nickname = 'Parent' and pin_protected;
                                                            if n = 1 then passed := passed + 1; else failed := failed || ' [adult profiles always PIN protected]'; end if;

  perform public.set_household_pin('2580');
  ok := public.verify_household_pin('1111');                if not ok then passed := passed + 1; else failed := failed || ' [wrong PIN rejected]'; end if;
  ok := public.verify_household_pin('2580');                if ok then passed := passed + 1; else failed := failed || ' [right PIN accepted]'; end if;
  for i in 1..5 loop perform public.verify_household_pin('0000'); end loop;
  begin perform public.verify_household_pin('2580');
        failed := failed || ' [PIN locks after 5 wrong tries]';
  exception when others then passed := passed + 1; end;

  for i in 1..4 loop insert into public.profiles (household_id, nickname, age_band) values (ha, 'Kid' || i, 'under-6'); end loop;
  begin insert into public.profiles (household_id, nickname, age_band) values (ha, 'Seventh', 'under-6');
        failed := failed || ' [6-profile cap enforced]';
  exception when others then passed := passed + 1; end;

  select jsonb_array_length(public.export_my_household()->'profiles') into n;
                                                            if n = 6 then passed := passed + 1; else failed := failed || ' [export contains own 6 profiles only]'; end if;

  begin perform public.log_audit('x', 'spam');
        failed := failed || ' [members cannot write audit log]';
  exception when others then passed := passed + 1; end;

  delete from public.profiles where id = pa_child;
  perform set_config('role', me, true);
  select count(*) into n from public.completions where profile_id = pa_child;
                                                            if n = 0 then passed := passed + 1; else failed := failed || ' [deleting a profile deletes its activity]'; end if;

  -- ---------- as creator C ----------
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.creators;             if n = 1 then passed := passed + 1; else failed := failed || ' [creator sees only own record]'; end if;
  select count(*) into n from public.ledger_entries;       if n = 1 then passed := passed + 1; else failed := failed || ' [creator sees only own ledger]'; end if;
  select count(*) into n from public.profiles;             if n = 0 then passed := passed + 1; else failed := failed || ' [creator sees no child profiles]'; end if;
  select count(*) into n from public.households;           if n = 0 then passed := passed + 1; else failed := failed || ' [creator sees no households]'; end if;
  select count(*) into n from public.completions;          if n = 0 then passed := passed + 1; else failed := failed || ' [creator sees no viewing activity]'; end if;
  perform set_config('role', me, true);

  -- ---------- as support staff ----------
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.profiles;             if n = 0 then passed := passed + 1; else failed := failed || ' [staff cannot read child profiles]'; end if;
  perform set_config('role', me, true);

  -- ---------- as content editor ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.workouts where slug like 't-%';             if n = 2 then passed := passed + 1; else failed := failed || ' [editor sees drafts]'; end if;
  begin update public.workouts set state = 'published' where id = w_draft;
        failed := failed || ' [cannot publish without rights cleared]';
  exception when others then passed := passed + 1; end;
  begin update public.workouts set rights_creator_licence_signed = true, rights_music_cleared = true, rights_safety_reviewed = true,
          state = 'published' where id = w_draft;
        failed := failed || ' [cannot publish without video and captions]';
  exception when others then passed := passed + 1; end;
  update public.workouts set rights_creator_licence_signed = true, rights_music_cleared = true, rights_safety_reviewed = true,
    captions = true, mux_playback_id = 'test-playback', state = 'published' where id = w_draft;
  select count(*) into n from public.workouts where id = w_draft and state = 'published' and published_at is not null;
                                                            if n = 1 then passed := passed + 1; else failed := failed || ' [editor can publish once cleared]'; end if;
  perform set_config('role', me, true);

  -- ---------- as anonymous visitor ----------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin select count(*) into n from public.workouts;
        if n = 0 then passed := passed + 1; else failed := failed || ' [anonymous sees nothing]'; end if;
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- ---------- append-only, even for the database owner ----------
  begin update public.ledger_entries set amount_minor = 1 where id = 't-l1';
        failed := failed || ' [ledger cannot be edited]';
  exception when others then passed := passed + 1; end;
  begin delete from public.ledger_entries where id = 't-l1';
        failed := failed || ' [ledger cannot be deleted]';
  exception when others then passed := passed + 1; end;

  if failed <> '' then
    raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed;
  end if;
  raise exception 'ROLLBACK OK — ALL % CHECKS PASSED', passed;
end;
$fn$;
revoke execute on function tests.run_rls_checks() from public, anon, authenticated;

-- Admins link a creator (or a child creator's guardian) to an existing login, by email, so they see the creator
-- portal. The person must have signed up on the website first. Audited.
create or replace function public.admin_link_creator_login(p_creator uuid, p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not private.has_staff_role('{admin}') then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email yet. Ask them to sign up on the website first, then try again.'; end if;
  if not exists (select 1 from public.creators where id = p_creator) then raise exception 'No such creator'; end if;
  insert into public.creator_users (creator_id, user_id) values (p_creator, uid) on conflict do nothing;
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'creators', 'Linked creator portal login',
          jsonb_build_object('creator_id', p_creator, 'email', lower(trim(p_email))));
  return 'linked';
end $$;
revoke all on function public.admin_link_creator_login(uuid, text) from public, anon;
grant execute on function public.admin_link_creator_login(uuid, text) to authenticated;

-- ---------- Price notices ----------
-- 1. Promo ending: when a family's next payment is the first at full price (their promo has ended by then) and
--    it's within 10 days, email them once. Runs daily.
create or replace function private.queue_promo_ending_notices() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.member_notices (household_id, kind, dedupe_key, due_at, detail)
  select e.household_id, 'promo_ending', 'promo_ending:' || e.household_id || ':' || to_char(e.discount_ends_at, 'YYYY-MM-DD'), now(),
         jsonb_build_object('amount_minor', e.discounted_price_minor, 'then_minor', e.price_minor,
                            'discount_ends_at', e.discount_ends_at, 'next_charge', e.current_period_end, 'interval', 'month')
  from public.entitlements e join public.households h on h.id = e.household_id
  where e.provider = 'stripe' and e.status = 'active' and not coalesce(e.cancel_at_period_end, false)
    and h.closed_at is null
    and e.discount_ends_at is not null and e.discounted_price_minor is not null and e.price_minor is not null
    and e.current_period_end >= e.discount_ends_at
    and e.current_period_end between now() and now() + interval '10 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.queue_promo_ending_notices() from public, anon, authenticated;
select cron.schedule('promo-ending-notices', '23 22 * * *', $$ select private.queue_promo_ending_notices() $$);

-- 2. Price change: an admin announces it at least 30 days ahead; every family on that plan is emailed once.
--    (Switching the actual Stripe price on the day is a separate, deliberate step.)
create table if not exists public.price_changes (
  id bigint generated always as identity primary key,
  plan_key text not null,
  old_price_minor int not null,
  new_price_minor int not null check (new_price_minor > 0),
  effective_date date not null,
  reason text,
  notified int not null default 0,
  announced_by uuid,
  announced_at timestamptz not null default now()
);
alter table public.price_changes enable row level security;
create policy price_changes_read on public.price_changes for select using (private.has_staff_role('{admin,finance}'::public.staff_role[]));
revoke insert, update, delete on public.price_changes from anon, authenticated;

create or replace function public.admin_announce_price_change(p_plan_key text, p_old_minor int, p_new_minor int, p_effective date, p_reason text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare cid bigint; n int;
begin
  if not private.has_staff_role('{admin}') then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if p_plan_key like '%founder%' then raise exception 'Founding families keep their price — that plan can’t be changed this way'; end if;
  if p_effective < (now() at time zone 'Australia/Sydney')::date + 30 then raise exception 'Give at least 30 days’ notice (effective date on or after %)', (now() at time zone 'Australia/Sydney')::date + 30; end if;
  if p_new_minor <= 0 or p_new_minor = p_old_minor then raise exception 'Enter the new price'; end if;
  insert into public.price_changes (plan_key, old_price_minor, new_price_minor, effective_date, reason, announced_by)
    values (p_plan_key, p_old_minor, p_new_minor, p_effective, nullif(trim(p_reason), ''), (select auth.uid())) returning id into cid;
  insert into public.member_notices (household_id, kind, dedupe_key, due_at, detail)
  select e.household_id, 'price_change', 'price_change:' || cid || ':' || e.household_id, now(),
         jsonb_build_object('old_minor', p_old_minor, 'new_minor', p_new_minor, 'effective', p_effective,
                            'interval', case when p_plan_key like '%annual%' then 'year' else 'month' end, 'reason', nullif(trim(p_reason), ''))
  from public.entitlements e join public.households h on h.id = e.household_id
  where e.plan_key = p_plan_key and e.status in ('active', 'trialing', 'past_due') and h.closed_at is null
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  update public.price_changes set notified = n where id = cid;
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), (select auth.jwt()) ->> 'email', 'pricing', 'Price change announced',
          jsonb_build_object('plan', p_plan_key, 'old', p_old_minor, 'new', p_new_minor, 'effective', p_effective, 'families', n));
  return n;
end $$;
revoke all on function public.admin_announce_price_change(text, int, int, date, text) from public, anon;
grant execute on function public.admin_announce_price_change(text, int, int, date, text) to authenticated;
