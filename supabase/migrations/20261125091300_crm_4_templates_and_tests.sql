-- Creator Acquisition CRM, part 4 of 4: default templates and the test suite.

-- Default outreach templates (version 1). Edit them in Creator Acquisition → Templates; every edit saves a new version.
-- Merge fields without a fallback must be filled from real data, or the message has to be edited before use.
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Already selling individual workouts$t$, 'dm', 'initial', '{}'::text[], array[$t$Sells individual workouts$t$], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! {{specific_personalisation_detail}} — that's exactly the kind of workout we'd love to have on G.Fit.

I'm {{founder_name}}, founder of G.Fit, a new on-demand fitness streaming service for whole households, launching {{launch_date}}. We're inviting a small group of founding creators to earn from workouts they've already made, through content royalties and subscriber referral commission. There's no joining fee.

Would you be open to me sending a few details?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Existing monthly membership$t$, 'dm', 'initial', '{}'::text[], array[$t$Runs a membership$t$], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! I came across your membership — {{specific_personalisation_detail}}.

I'm {{founder_name}}, founder of G.Fit. We're launching an on-demand fitness streaming service for whole households on {{launch_date}}, and we handle the app, streaming and billing so creators can focus on their workouts. Founding creators earn from content royalties and subscriber referrals, with no joining fee.

Could I send you a short overview?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$YouTube creator with a video library$t$, 'dm', 'initial', '{}'::text[], array[$t$YouTube creator$t$], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! I've been watching your channel — {{specific_personalisation_detail}}.

I'm {{founder_name}}, founder of G.Fit, a new fitness streaming service for whole households launching {{launch_date}}. We're looking for a small group of founding creators whose existing full-length workouts could earn through content royalties and subscriber referrals. No joining fee.

Would you like to hear more?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Independent fitness instructor (email)$t$, 'email', 'initial', '{}'::text[], array[$t$Independent instructor$t$], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$A founding creator place at G.Fit$t$, $t$Hi {{creator_first_name|there}},

I'm {{founder_name}}, founder of G.Fit — a new on-demand fitness streaming service for whole households, launching {{launch_date}}.

I'm writing because {{specific_personalisation_detail}}. {{recommended_pitch_angle|We think your workouts would suit our members.}}

We're inviting a small group of founding creators to join before launch. Creators earn from content royalties and subscriber referral commission, there's no joining fee, and we look after the app, streaming and billing.

Would you be open to a short call, or should I send an overview by email?

Thanks,

{{founder_name}}
Founder, G.Fit

If you'd rather not hear from G.Fit, just reply "no thanks" and we won't contact you again.$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Pilates and yoga instructors$t$, 'dm', 'initial', array[$t$Pilates and barre$t$,$t$Yoga and mobility$t$], '{}'::text[], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! {{specific_personalisation_detail}} — lovely work.

I'm {{founder_name}}, founder of G.Fit. We're launching an on-demand fitness streaming service for whole households on {{launch_date}}, and {{primary_category|Pilates and yoga}} is one of the areas we most want to get right. Founding creators earn from content royalties and subscriber referrals, with no joining fee.

Would you be open to hearing more?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Dance instructors$t$, 'dm', 'initial', array[$t$Dance fitness$t$], '{}'::text[], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! {{specific_personalisation_detail}} — your energy is brilliant.

I'm {{founder_name}}, founder of G.Fit, a new fitness streaming service for whole households launching {{launch_date}}. Dance fitness is one of our founding categories, and we'd love your workouts to be part of it. Founding creators earn from content royalties and subscriber referrals, with no joining fee.

Could I send you some details?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Kids and family fitness instructors$t$, 'dm', 'initial', array[$t$Kids and family fitness$t$], '{}'::text[], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! {{specific_personalisation_detail}}.

I'm {{founder_name}}, founder of G.Fit, a fitness streaming service for whole households launching {{launch_date}} — adults have their own workouts and kids get age-appropriate profiles in the same membership. We're looking for founding creators who make family-friendly fitness. Creators earn from content royalties and subscriber referrals, with no joining fee.

Would you be open to hearing more?$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Fitness studio owners (email)$t$, 'email', 'initial', '{}'::text[], array[$t$Studio owner$t$], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Your studio's classes on G.Fit$t$, $t$Hi {{creator_first_name|there}},

I'm {{founder_name}}, founder of G.Fit, an on-demand fitness streaming service for whole households launching {{launch_date}}.

{{specific_personalisation_detail}}. We're inviting a small number of studios to join as founding creators, so classes you've already filmed can reach new members at home. Creators earn from content royalties and subscriber referral commission, with no joining fee.

Would a short call in the next week or two suit?

Thanks,

{{founder_name}}
Founder, G.Fit

If you'd rather not hear from G.Fit, just reply "no thanks" and we won't contact you again.$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$First follow-up$t$, 'dm', 'follow_up', '{}'::text[], '{}'::text[], 1, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}, just bringing my earlier message back to the top in case it got buried. We're opening G.Fit on {{launch_date}} with a small group of founding creators, and I'd love to tell you more if it's of interest. No pressure at all.$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Final follow-up$t$, 'dm', 'follow_up', '{}'::text[], '{}'::text[], 2, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}, I'll leave it here so I'm not filling your inbox. If you'd ever like to hear about founding creator places at G.Fit, just reply and I'll send the details. Wishing you all the best with {{business_name|your work}}!$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Interested creator response$t$, 'email', 'interested_response', '{}'::text[], '{}'::text[], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Next steps for G.Fit founding creators$t$, $t$Hi {{creator_first_name|there}},

Thank you for getting back to me — I'm really glad you're interested.

The next step is a short application (about five minutes), which tells us about your workouts and the rights to them:
{{founding_creator_application_url}}

Once we've reviewed it, we'll send the creator agreement with the commercial terms for you to read before anything is signed. Happy to answer any questions in the meantime.

Thanks,

{{founder_name}}
Founder, G.Fit$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Application invitation$t$, 'email', 'application_invitation', '{}'::text[], '{}'::text[], null, null, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Your G.Fit founding creator application$t$, $t$Hi {{creator_first_name|there}},

As promised, here's your personal application link for a founding creator place at G.Fit:
{{founding_creator_application_url}}

It takes about five minutes. We launch on {{launch_date}}, so the sooner we have it, the more time we'll have to get your workouts ready.

Thanks,

{{founder_name}}
Founder, G.Fit$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Agreement reminder$t$, 'email', 'agreement_reminder', '{}'::text[], '{}'::text[], null, null, false) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Your G.Fit creator agreement$t$, $t$Hi {{creator_first_name|there}},

A quick reminder that your G.Fit creator agreement is ready for you to review and accept in the creator portal. If anything in it is unclear, reply to this email and I'll help.

Thanks,

{{founder_name}}
Founder, G.Fit$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Content upload reminder$t$, 'email', 'content_reminder', '{}'::text[], '{}'::text[], null, null, false) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Uploading your first workouts$t$, $t$Hi {{creator_first_name|there}},

You're nearly ready for launch on {{launch_date}}. The next step is uploading your workouts in the creator portal — each one is reviewed before it goes live.

Reply if you'd like a hand with anything.

Thanks,

{{founder_name}}
Founder, G.Fit$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Creator nomination request$t$, 'email', 'nomination_request', '{}'::text[], '{}'::text[], null, null, false) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Know another instructor who'd suit G.Fit?$t$, $t$Hi {{creator_first_name|there}},

Thank you for being one of our founding creators. If you know another fitness professional whose workouts would suit G.Fit, we'd love you to share your nomination link with them:
{{referral_link}}

Please share the link rather than their contact details — they can apply themselves if they're interested.

Thanks,

{{founder_name}}
Founder, G.Fit$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Fitness education organisation partnership$t$, 'email', 'partnership', '{}'::text[], '{}'::text[], null, $t$Fitness education organisation$t$, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, $t$Partnering with G.Fit on creator opportunities$t$, $t$Hi {{creator_first_name|there}},

I'm {{founder_name}}, founder of G.Fit, an on-demand fitness streaming service for whole households launching {{launch_date}}.

We're building a group of founding creators and would love to make the opportunity known to qualified instructors in your community. {{specific_personalisation_detail|}}

Would you be open to a short conversation about how this could work for your members?

Thanks,

{{founder_name}}
Founder, G.Fit

If you'd rather not hear from G.Fit, just reply "no thanks" and we won't contact you again.$t$ from t;
with t as (insert into public.crm_templates (name, channel, purpose, categories, creator_types, follow_up_number, partnership_type, commercial)
  values ($t$Fitness community administrator partnership$t$, 'dm', 'partnership', '{}'::text[], '{}'::text[], null, $t$Fitness community$t$, true) returning id)
insert into public.crm_template_versions (template_id, version, subject, body) select id, 1, null, $t$Hi {{creator_first_name|there}}! I'm {{founder_name}}, founder of G.Fit, a fitness streaming service for whole households launching {{launch_date}}. We're looking for founding creators, and your community seems full of exactly the kind of instructors we'd love to hear from. Would you be open to me sharing a short post about it, if it fits your group's rules?$t$ from t;


-- ---------------------------------------------------------------------------------------------------------------
-- Test suite: select tests.run_crm_checks();   (always rolls back; the message is the result)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function tests.run_crm_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  adm uuid := gen_random_uuid(); rec uuid := gen_random_uuid(); fam uuid := gen_random_uuid();
  b uuid; p1 uuid; p2 uuid; p3 uuid; r jsonb; n int; s text; x numeric;
  passed int := 0; failed text := '';
  procedure_ok boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (adm, 'crm-admin@test.invalid', 'authenticated', 'authenticated'),
    (rec, 'crm-recruiter@test.invalid', 'authenticated', 'authenticated'),
    (fam, 'crm-family@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_members (user_id, role) values (adm, 'admin'), (rec, 'recruiter');
  insert into public.households (owner_user_id) values (fam);

  -- ===== as the recruiter =====
  perform set_config('request.jwt.claims', json_build_object('sub', rec, 'role', 'authenticated', 'email', 'crm-recruiter@test.invalid')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.crm_import_batches (file_name) values ('TEST fictional.csv') returning id into b;
  r := public.crm_import_commit(b, jsonb_build_array(
    jsonb_build_object('line', 2, 'action', 'insert',
      'data', jsonb_build_object('creator_name', 'FICTIONAL Amy Test', 'country', 'Australia', 'instagram_url', 'https://www.instagram.com/fict.amy/',
        'public_business_email', 'amy@fict.invalid', 'instagram_followers', null, 'full_length_workouts_available', null,
        'existing_content_score', 25, 'audience_engagement_score', 18, 'monetisation_score', 16, 'promotion_potential_score', 16,
        'qualification_quality_score', 8, 'catalogue_gap_score', 4, 'research_date', '2026-11-01', 'business_name', 'Old Biz',
        'allocation_category', 'Pilates and barre', 'notes', 'Imported note', 'next_follow_up_date', '2026-12-01'),
      'keys', jsonb_build_object('instagram', 'fict.amy', 'email', 'amy@fict.invalid', 'name', 'fictional amy test|australia')),
    jsonb_build_object('line', 3, 'action', 'insert',
      'data', jsonb_build_object('creator_name', 'FICTIONAL Bo Test', 'tiktok_url', 'https://www.tiktok.com/@fict.bo', 'total_fit_score', 70),
      'keys', jsonb_build_object('tiktok', 'fict.bo')),
    jsonb_build_object('line', 4, 'action', 'insert', 'data', jsonb_build_object('creator_name', 'FICTIONAL Bad', 'instagram_url', 'javascript:alert(1)'),
      'keys', '{}'::jsonb)));
  select (r -> 0 ->> 'id')::uuid, (r -> 1 ->> 'id')::uuid into p1, p2;
  if r -> 0 ->> 'result' = 'inserted' and r -> 1 ->> 'result' = 'inserted' and r -> 2 ->> 'result' = 'failed' then passed := passed + 1;
  else failed := failed || ' [import inserts good rows, fails a bad link: ' || r::text || ']'; end if;

  select count(*) into n from public.crm_prospects where id = p1 and instagram_followers is null and full_length_workouts_available is null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [unknown stays unknown]'; end if;
  select fit_score, fit_tier into x, s from public.crm_prospects where id = p1;
  if x = 87 and s = 'A' then passed := passed + 1; else failed := failed || format(' [fit score 87/A, got %s/%s]', x, s); end if;
  select fit_score into x from public.crm_prospects where id = p2;
  if x = 70 then passed := passed + 1; else failed := failed || ' [researched total used when no criteria]'; end if;
  select count(*) into n from public.crm_activities where prospect_id = p1 and kind = 'note' and body = 'Imported note';
  select n + count(*) into n from public.crm_tasks where prospect_id = p1 and due_on = '2026-12-01';
  if n = 2 then passed := passed + 1; else failed := failed || ' [file notes and follow-up date kept on insert]'; end if;
  select count(*) into n from public.crm_prospects where id = p1 and field_sources -> 'instagram_url' ->> 'batch' = b::text;
  if n = 1 then passed := passed + 1; else failed := failed || ' [provenance recorded]'; end if;

  -- outreach: copying/opening does nothing; confirming logs it and schedules the follow-up
  select count(*) into n from public.crm_activities where prospect_id = p1 and kind = 'outreach';
  if n = 0 then passed := passed + 1; else failed := failed || ' [nothing logged before confirmation]'; end if;
  r := public.crm_log_outreach(p1, 'instagram', 'Hi Amy (fictional)');
  select count(*) into n from public.crm_prospects where id = p1 and stage = 'contacted' and outbound_count = 1 and last_contact_at is not null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [outreach moves to Contacted]'; end if;
  select count(*) into n from public.crm_tasks where prospect_id = p1 and kind = 'follow_up' and status = 'open' and follow_up_number = 1
    and due_on = private.crm_today() + 4;
  if n = 1 then passed := passed + 1; else failed := failed || ' [follow-up task created in 4 days]'; end if;
  begin perform public.crm_log_outreach(p1, 'instagram', 'again'); failed := failed || ' [duplicate message blocked]';
  exception when raise_exception then passed := passed + 1; end;
  begin perform public.crm_log_outreach(p1, 'email', 'Hi'); failed := failed || ' [email needs permission confirmed]';
  exception when raise_exception then passed := passed + 1; end;
  perform public.crm_log_outreach(p1, 'email', 'Hi by email', 'Subject', null, null, true);
  select count(*) into n from public.crm_prospects where id = p1 and outreach_permission_status = 'published_business_contact';
  if n = 1 then passed := passed + 1; else failed := failed || ' [confirming permission is recorded]'; end if;

  -- a later research file: newer research refreshes research fields only; stage/notes/history untouched
  insert into public.crm_import_batches (file_name) values ('TEST fictional v2.csv') returning id into b;
  r := public.crm_import_commit(b, jsonb_build_array(jsonb_build_object('line', 2, 'action', 'update_research', 'target_id', p1,
    'data', jsonb_build_object('creator_name', 'FICTIONAL Amy Test', 'business_name', 'New Biz', 'instagram_followers', 15000, 'research_date', '2026-11-20',
      'recruitment_status', 'identified', 'notes', 'should not be added'),
    'keys', jsonb_build_object('instagram', 'fict.amy'))));
  select count(*) into n from public.crm_prospects where id = p1 and business_name = 'New Biz' and instagram_followers = 15000 and stage = 'contacted';
  if n = 1 and r -> 0 ->> 'result' = 'updated' then passed := passed + 1; else failed := failed || ' [newer research refreshes; stage untouched: ' || r::text || ']'; end if;
  select count(*) into n from public.crm_activities where prospect_id = p1 and kind = 'note';
  if n = 1 then passed := passed + 1; else failed := failed || ' [notes never added by updates]'; end if;
  r := public.crm_import_commit(b, jsonb_build_array(jsonb_build_object('line', 3, 'action', 'update_research', 'target_id', p1,
    'data', jsonb_build_object('business_name', 'Older Biz', 'city', 'Perth', 'research_date', '2026-10-01'), 'keys', '{}'::jsonb)));
  select count(*) into n from public.crm_prospects where id = p1 and business_name = 'New Biz' and city = 'Perth';
  if n = 1 then passed := passed + 1; else failed := failed || ' [older research only fills blanks]'; end if;
  r := public.crm_import_commit(b, jsonb_build_array(jsonb_build_object('line', 4, 'action', 'fill_blanks', 'target_id', p1,
    'data', jsonb_build_object('business_name', 'Other', 'city', 'Perth'), 'keys', '{}'::jsonb)));
  if r -> 0 ->> 'result' = 'unchanged' then passed := passed + 1; else failed := failed || ' [re-importing the same facts changes nothing]'; end if;

  -- pipeline rules
  begin perform public.crm_set_stage(array[p1], 'agreement_accepted', 'I said so'); failed := failed || ' [recruiter cannot drag to a system stage]';
  exception when raise_exception then passed := passed + 1; end;
  begin update public.crm_prospects set stage = 'launch_ready' where id = p1; failed := failed || ' [direct update to a system stage refused]';
  exception when insufficient_privilege then passed := passed + 1; end;
  perform public.crm_set_stage(array[p2], 'interested');
  perform public.crm_set_stage(array[p2], 'contacted');
  perform public.crm_set_stage(array[p2], 'interested');
  select count(*) into n from public.crm_stage_reached where prospect_id = p2 and stage = 'interested';
  if n = 1 then passed := passed + 1; else failed := failed || ' [moving back and forth counts once]'; end if;

  -- replies
  perform public.crm_record_response(p1, 'positive', 'Sounds great (fictional)', 'instagram', 'Worried about exclusivity');
  select count(*) into n from public.crm_prospects where id = p1 and stage = 'interested' and last_inbound_at is not null;
  select n + count(*) into n from public.crm_tasks where prospect_id = p1 and kind = 'reply' and status = 'open';
  select n + count(*) into n from public.crm_tasks where prospect_id = p1 and kind = 'follow_up' and status = 'open';
  if n = 2 then passed := passed + 1; else failed := failed || ' [positive reply → Interested, reply task, follow-ups closed]'; end if;

  -- history is append-only
  update public.crm_activities set body = 'tampered' where prospect_id = p1; -- no update policy: changes nothing
  perform set_config('role', me, true);
  select count(*) into n from public.crm_activities where body = 'tampered';
  begin update public.crm_activities set body = 'tampered' where prospect_id = p1; n := n + 100; -- even the table owner is stopped
  exception when insufficient_privilege then null; end;
  if n = 0 then passed := passed + 1; else failed := failed || ' [history cannot be edited]'; end if;
  perform set_config('role', 'authenticated', true);

  -- do-not-contact
  perform public.crm_set_dnc(p2, 'Asked us not to contact (fictional)');
  select count(*) into n from public.crm_prospects where id = p2 and do_not_contact and stage = 'do_not_contact';
  if n = 1 then passed := passed + 1; else failed := failed || ' [DNC sets the stage]'; end if;
  select count(*) into n from public.crm_suppressions where key_hash = private.crm_hash('tiktok', 'fict.bo');
  if n = 1 then passed := passed + 1; else failed := failed || ' [DNC kept as a fingerprint]'; end if;
  select count(*) into n from public.crm_outreach_queue(500) q where (q.prospect ->> 'id')::uuid = p2;
  if n = 0 then passed := passed + 1; else failed := failed || ' [DNC excluded from queue]'; end if;
  r := public.crm_set_stage(array[p1, p2], 'qualified');
  if (r ->> 'moved')::int = 1 and jsonb_array_length(r -> 'skipped') = 1 then passed := passed + 1; else failed := failed || ' [bulk stage change skips DNC]'; end if;
  begin perform public.crm_log_outreach(p2, 'tiktok', 'hi'); failed := failed || ' [cannot log outreach to DNC]';
  exception when raise_exception then passed := passed + 1; end;
  begin perform public.crm_clear_dnc(p2, 'please'); failed := failed || ' [recruiter cannot clear DNC]';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin update public.crm_prospects set do_not_contact = false where id = p2; failed := failed || ' [DNC cannot be cleared by a direct edit]';
  exception when raise_exception then passed := passed + 1; end;
  insert into public.crm_import_batches (file_name) values ('TEST fictional v3.csv') returning id into b;
  r := public.crm_import_commit(b, jsonb_build_array(jsonb_build_object('line', 2, 'action', 'insert',
    'data', jsonb_build_object('creator_name', 'FICTIONAL Bo Again', 'tiktok_url', 'https://www.tiktok.com/@fict.bo'), 'keys', jsonb_build_object('tiktok', 'fict.bo'))));
  p3 := (r -> 0 ->> 'id')::uuid;
  select count(*) into n from public.crm_prospects where id = p3 and do_not_contact;
  if n = 1 then passed := passed + 1; else failed := failed || ' [re-imported DNC creator stays DNC]'; end if;

  -- queue picks eligible new prospects with reasons
  perform public.crm_import_commit(b, jsonb_build_array(jsonb_build_object('line', 3, 'action', 'insert',
    'data', jsonb_build_object('creator_name', 'FICTIONAL Cy Queue', 'instagram_url', 'https://www.instagram.com/fict.cy/', 'confidence_level', 'high', 'total_fit_score', 90,
      'personalised_initial_dm', 'Hi Cy (fictional)'), 'keys', jsonb_build_object('instagram', 'fict.cy')),
    jsonb_build_object('line', 4, 'action', 'insert',
      'data', jsonb_build_object('creator_name', 'FICTIONAL No Channel'), 'keys', '{}'::jsonb)));
  select count(*) into n from public.crm_outreach_queue(500) q where q.prospect ->> 'creator_name' = 'FICTIONAL Cy Queue' and 'Prepared message ready' = any (q.reasons);
  select n + count(*) into n from public.crm_outreach_queue(500) q where q.prospect ->> 'creator_name' = 'FICTIONAL No Channel';
  if n = 1 then passed := passed + 1; else failed := failed || ' [queue: eligible in, no-channel out]'; end if;

  -- recruiters can't export, change settings or see the audit log
  begin perform public.crm_export_prospects(array[p1]); failed := failed || ' [recruiter cannot export]';
  exception when insufficient_privilege then passed := passed + 1; end;
  update public.crm_settings set founder_name = 'Hacker' where id = 1;
  select count(*) into n from public.crm_settings where founder_name = 'Hacker';
  if n = 0 then passed := passed + 1; else failed := failed || ' [recruiter cannot change settings]'; end if;

  -- dashboard and funnel run
  r := public.crm_dashboard();
  if (r ->> 'total')::int >= 4 and (r ->> 'contacted')::int >= 1 then passed := passed + 1; else failed := failed || ' [dashboard counts]'; end if;
  select count(*) into n from public.crm_funnel(private.crm_today() - 1, private.crm_today(), 'all') f where f.contacted >= 1;
  if n = 1 then passed := passed + 1; else failed := failed || ' [funnel]'; end if;
  perform set_config('role', me, true);

  -- ===== a family member sees nothing =====
  perform set_config('request.jwt.claims', json_build_object('sub', fam, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.crm_prospects;
  select n + count(*) into n from public.crm_activities;
  select n + count(*) into n from public.crm_templates;
  if n = 0 then passed := passed + 1; else failed := failed || ' [family members read no CRM data]'; end if;
  begin perform public.crm_dashboard(); failed := failed || ' [family member cannot open the dashboard]';
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- ===== anonymous visitors see nothing =====
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin select count(*) into n from public.crm_prospects;
    if n = 0 then passed := passed + 1; else failed := failed || ' [anon reads no prospects]'; end if;
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- ===== as the admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'crm-admin@test.invalid')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.crm_set_stage(array[p1], 'agreement_accepted', ''); failed := failed || ' [admin override needs a reason]';
  exception when raise_exception then passed := passed + 1; end;
  perform public.crm_set_stage(array[p1], 'agreement_accepted', 'Signed on paper (fictional test)');
  select count(*) into n from public.crm_prospects where id = p1 and stage = 'agreement_accepted';
  if n = 1 then passed := passed + 1; else failed := failed || ' [admin override with reason works]'; end if;
  select count(*) into n from public.audit_log where detail ->> 'prospect_id' = p1::text and action like 'Stage override%';
  if n = 1 then passed := passed + 1; else failed := failed || ' [override audited]'; end if;
  perform public.crm_clear_dnc(p3, 'Creator asked to hear from us (fictional)');
  select count(*) into n from public.crm_prospects where id = p3 and not do_not_contact and stage = 'revisit_later';
  select n + count(*) into n from public.crm_suppressions where key_hash = private.crm_hash('tiktok', 'fict.bo');
  if n = 1 then passed := passed + 1; else failed := failed || ' [admin clears DNC and the fingerprint]'; end if;
  select count(*) into n from public.crm_export_prospects(array[p1, p2]);
  if n = 2 then passed := passed + 1; else failed := failed || ' [admin export]'; end if;
  update public.crm_settings set scoring = jsonb_set(scoring, '{tiers}', '[{"tier":"A","min":90},{"tier":"B","min":75},{"tier":"C","min":60},{"tier":"D","min":0}]') where id = 1;
  select fit_tier into s from public.crm_prospects where id = p1;
  if s = 'B' then passed := passed + 1; else failed := failed || ' [changing tiers re-scores]'; end if;
  begin update public.crm_stages set system_event = false where key = 'launch_ready'; failed := failed || ' [built-in stage meaning locked]';
  exception when raise_exception then passed := passed + 1; end;
  update public.crm_stages set label = 'Ready to launch' where key = 'launch_ready';
  select count(*) into n from public.crm_stages where key = 'launch_ready' and label = 'Ready to launch';
  if n = 1 then passed := passed + 1; else failed := failed || ' [stages can be renamed]'; end if;
  delete from public.crm_prospects where id = p2;
  select count(*) into n from public.crm_activities where prospect_id = p2;
  select n + count(*) into n from public.crm_suppressions where key_hash = private.crm_hash('tiktok', 'fict.bo');
  if n = 0 then passed := passed + 1; else failed := failed || ' [deleting a prospect removes its history]'; end if;
  perform set_config('role', me, true);

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % CRM CHECKS PASSED', passed;
end $fn$;
revoke all on function tests.run_crm_checks() from public, anon, authenticated;
