-- Reusable privacy & permission test suite. Run with:  select tests.run_rls_checks();
-- It always raises at the end so every change it makes is rolled back.
-- Success message: "ROLLBACK OK — ALL n CHECKS PASSED".
create schema if not exists tests;
revoke all on schema tests from public, anon, authenticated;

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
  select count(*) into n from public.workouts;             if n = 1 then passed := passed + 1; else failed := failed || ' [members see published only]'; end if;
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
  select count(*) into n from public.workouts;             if n = 2 then passed := passed + 1; else failed := failed || ' [editor sees drafts]'; end if;
  begin update public.workouts set state = 'published' where id = w_draft;
        failed := failed || ' [cannot publish without rights cleared]';
  exception when others then passed := passed + 1; end;
  update public.workouts set rights_creator_licence_signed = true, rights_music_cleared = true, rights_safety_reviewed = true,
    state = 'published' where id = w_draft;
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
