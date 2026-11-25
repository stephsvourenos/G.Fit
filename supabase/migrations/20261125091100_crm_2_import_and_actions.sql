-- Creator Acquisition CRM, part 2 of 4: import and everyday actions (see part 1 for the rules).

-- ---------------------------------------------------------------------------------------------------------------
-- Import
-- ---------------------------------------------------------------------------------------------------------------
/**
 * Commit one chunk of a planned import. Each row: {line, action, target_id, data, keys, notes, next_follow_up_date, last_contact_date}.
 *   insert          → new prospect (stage, assignment, notes and follow-up from the file are used only here)
 *   fill_blanks     → only empty researched fields are filled
 *   update_research → researched fields are refreshed when the file's research_date is the same or newer than ours;
 *                     otherwise it behaves like fill_blanks. Stage, notes, history, assignment and do-not-contact are never touched.
 * Returns one result per row: {line, result: inserted|updated|unchanged|failed, id, error}.
 */
create or replace function public.crm_import_commit(p_batch uuid, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  row jsonb; r public.crm_prospects; t public.crm_prospects; nid uuid; res jsonb := '[]';
  cols text[] := private.crm_research_columns(); sets text; newer boolean; k jsonb; before jsonb;
  ins_cols text := (select string_agg(quote_ident(c), ', ') from unnest(private.crm_research_columns() || array['allocation_category',
    'key_instagram', 'key_tiktok', 'key_youtube', 'key_email', 'key_website', 'key_name', 'stage', 'assigned_to', 'tags',
    'original_recruitment_source', 'last_contact_at', 'import_batch_id', 'last_import_batch_id']::text[]) c);
begin
  perform private.crm_require_staff();
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Send at most 1,000 rows at a time'; end if;
  if not exists (select 1 from public.crm_import_batches b where b.id = p_batch and b.status = 'in_progress') then
    raise exception 'That import batch isn''t open';
  end if;
  perform set_config('gfit.crm_batch', p_batch::text, true);

  for row in select * from jsonb_array_elements(p_rows) loop
    begin
      r := jsonb_populate_record(null::public.crm_prospects, row -> 'data');
      k := coalesce(row -> 'keys', '{}');
      if row ->> 'action' = 'insert' then
        execute format('insert into public.crm_prospects (%1$s) select %1$s from jsonb_populate_record(null::public.crm_prospects, $1) returning id', ins_cols)
          using (select jsonb_object_agg(c, (row -> 'data') -> c) from unnest(cols) c where (row -> 'data') ? c)
          || jsonb_build_object(
               'allocation_category', (row -> 'data') ->> 'allocation_category',
               'key_instagram', k ->> 'instagram', 'key_tiktok', k ->> 'tiktok', 'key_youtube', k ->> 'youtube',
               'key_email', k ->> 'email', 'key_website', k ->> 'website', 'key_name', k ->> 'name',
               'stage', coalesce(nullif((row -> 'data') ->> 'recruitment_status', ''), 'identified'),
               'assigned_to', (row -> 'data') ->> 'assigned_to',
               'tags', coalesce(nullif((row -> 'data') -> 'tags', 'null'::jsonb), '[]'),
               'original_recruitment_source', coalesce((row -> 'data') ->> 'original_recruitment_source', 'Research import'),
               'last_contact_at', (row -> 'data') ->> 'last_contact_date',
               'import_batch_id', p_batch, 'last_import_batch_id', p_batch)
        into nid;
        insert into public.crm_activities (prospect_id, kind, detail) values (nid, 'import', jsonb_build_object('batch', p_batch, 'line', row -> 'line'));
        if nullif(btrim((row -> 'data') ->> 'notes'), '') is not null then
          insert into public.crm_activities (prospect_id, kind, body, detail)
          values (nid, 'note', (row -> 'data') ->> 'notes', jsonb_build_object('from_import', p_batch));
        end if;
        if (row -> 'data') ->> 'next_follow_up_date' is not null then
          insert into public.crm_tasks (prospect_id, kind, title, due_on, assigned_to)
          values (nid, 'follow_up', 'Follow up (date from research file)', ((row -> 'data') ->> 'next_follow_up_date')::date,
                  ((row -> 'data') ->> 'assigned_to')::uuid);
        end if;
        res := res || jsonb_build_object('line', row -> 'line', 'result', 'inserted', 'id', nid);
      elsif row ->> 'action' in ('fill_blanks', 'update_research') then
        select * into t from public.crm_prospects where id = (row ->> 'target_id')::uuid for update;
        if not found then raise exception 'The matching prospect no longer exists'; end if;
        before := to_jsonb(t);
        newer := row ->> 'action' = 'update_research' and r.research_date is not null
                 and (t.research_date is null or r.research_date >= t.research_date);
        select string_agg(format(case when newer then '%1$I = coalesce(($1).%1$I, t.%1$I)' else '%1$I = coalesce(t.%1$I, ($1).%1$I)' end, c), ', ')
          into sets from unnest(cols) c where (row -> 'data') ? c and (row -> 'data') -> c <> 'null'::jsonb;
        if sets is not null then
          execute format('update public.crm_prospects t set %s, last_import_batch_id = $2,
              allocation_category = coalesce(allocation_category, $3) where t.id = $4', sets)
            using r, p_batch, (row -> 'data') ->> 'allocation_category', t.id;
          -- keep the matching keys in step with whichever profile links are now stored
          update public.crm_prospects p set
            key_instagram = case when p.instagram_url is not distinct from r.instagram_url and r.instagram_url is not null then coalesce(k ->> 'instagram', p.key_instagram) else p.key_instagram end,
            key_tiktok = case when p.tiktok_url is not distinct from r.tiktok_url and r.tiktok_url is not null then coalesce(k ->> 'tiktok', p.key_tiktok) else p.key_tiktok end,
            key_youtube = case when p.youtube_url is not distinct from r.youtube_url and r.youtube_url is not null then coalesce(k ->> 'youtube', p.key_youtube) else p.key_youtube end,
            key_email = case when p.public_business_email is not distinct from r.public_business_email and r.public_business_email is not null then coalesce(k ->> 'email', p.key_email) else p.key_email end,
            key_website = case when p.website_url is not distinct from r.website_url and r.website_url is not null then coalesce(k ->> 'website', p.key_website) else p.key_website end,
            key_name = case when p.creator_name = r.creator_name and p.country is not distinct from r.country then coalesce(k ->> 'name', p.key_name) else p.key_name end
          where p.id = t.id
            and (p.key_instagram, p.key_tiktok, p.key_youtube, p.key_email, p.key_website, p.key_name) is distinct from (
              case when p.instagram_url is not distinct from r.instagram_url and r.instagram_url is not null then coalesce(k ->> 'instagram', p.key_instagram) else p.key_instagram end,
              case when p.tiktok_url is not distinct from r.tiktok_url and r.tiktok_url is not null then coalesce(k ->> 'tiktok', p.key_tiktok) else p.key_tiktok end,
              case when p.youtube_url is not distinct from r.youtube_url and r.youtube_url is not null then coalesce(k ->> 'youtube', p.key_youtube) else p.key_youtube end,
              case when p.public_business_email is not distinct from r.public_business_email and r.public_business_email is not null then coalesce(k ->> 'email', p.key_email) else p.key_email end,
              case when p.website_url is not distinct from r.website_url and r.website_url is not null then coalesce(k ->> 'website', p.key_website) else p.key_website end,
              case when p.creator_name = r.creator_name and p.country is not distinct from r.country then coalesce(k ->> 'name', p.key_name) else p.key_name end);
        end if;
        res := res || jsonb_build_object('line', row -> 'line', 'id', t.id,
          'result', case when (select to_jsonb(p) - 'updated_at' - 'field_sources' - 'last_import_batch_id' from public.crm_prospects p where p.id = t.id)
                              = before - 'updated_at' - 'field_sources' - 'last_import_batch_id' then 'unchanged' else 'updated' end);
      else
        raise exception 'Unknown import action %', row ->> 'action';
      end if;
    exception when others then
      res := res || jsonb_build_object('line', row -> 'line', 'result', 'failed', 'error', sqlerrm);
    end;
  end loop;
  perform set_config('gfit.crm_batch', '', true);
  return res;
end $$;

create or replace function public.crm_import_finish(p_batch uuid, p_stats jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  update public.crm_import_batches set status = 'complete', finished_at = now(), stats = p_stats where id = p_batch and status = 'in_progress';
  perform private.crm_audit(format('Prospect import: %s', (select file_name from public.crm_import_batches where id = p_batch)),
          jsonb_build_object('batch', p_batch, 'stats', p_stats));
end $$;

/** Matching keys of every prospect (for duplicate checks before an import). Pages of 5,000. */
create or replace function public.crm_match_index(p_after bigint default 0)
returns table (ref bigint, id uuid, key_instagram text, key_tiktok text, key_youtube text, key_email text, key_website text, key_name text, creator_name text)
language sql stable security invoker set search_path = '' as $$
  select p.ref, p.id, p.key_instagram, p.key_tiktok, p.key_youtube, p.key_email, p.key_website, p.key_name, p.creator_name
  from public.crm_prospects p where p.ref > p_after order by p.ref limit 5000
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Working with prospects
-- ---------------------------------------------------------------------------------------------------------------
/** Edit researched/contact details, tags, assignment or permission status. Keys come from the shared rules in the browser. */
create or replace function public.crm_update_prospect(p_id uuid, p_patch jsonb, p_keys jsonb default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  allowed text[] := private.crm_research_columns() || array['allocation_category', 'tags', 'assigned_to', 'outreach_permission_status',
                    'contact_verified_on', 'recruitment_outcome', 'reason_lost', 'original_recruitment_source', 'snoozed_until']::text[];
  bad text; sets text; r public.crm_prospects;
begin
  perform private.crm_require_staff();
  select k into bad from jsonb_object_keys(p_patch) k where k <> all (allowed) limit 1;
  if bad is not null then raise exception 'The field % can''t be edited here', bad; end if;
  r := jsonb_populate_record(null::public.crm_prospects, p_patch);
  select string_agg(format('%1$I = ($1).%1$I', k), ', ') into sets from jsonb_object_keys(p_patch) k;
  if sets is null then return; end if;
  execute format('update public.crm_prospects set %s where id = $2', sets) using r, p_id;
  if p_keys is not null then
    update public.crm_prospects set key_instagram = p_keys ->> 'instagram', key_tiktok = p_keys ->> 'tiktok', key_youtube = p_keys ->> 'youtube',
      key_email = p_keys ->> 'email', key_website = p_keys ->> 'website', key_name = p_keys ->> 'name'
    where id = p_id and (key_instagram, key_tiktok, key_youtube, key_email, key_website, key_name) is distinct from
      (p_keys ->> 'instagram', p_keys ->> 'tiktok', p_keys ->> 'youtube', p_keys ->> 'email', p_keys ->> 'website', p_keys ->> 'name');
  end if;
  if p_patch ? 'outreach_permission_status' then
    insert into public.crm_activities (prospect_id, kind, detail) values (p_id, 'permission', jsonb_build_object('status', p_patch ->> 'outreach_permission_status'));
  end if;
end $$;

/** Move one or many prospects. Do-not-contact prospects are skipped (they can only go to closed outcomes). */
create or replace function public.crm_set_stage(p_ids uuid[], p_stage text, p_reason text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  st public.crm_stages%rowtype; pid uuid; moved int := 0; skipped jsonb := '[]'; p public.crm_prospects;
begin
  perform private.crm_require_staff();
  select * into st from public.crm_stages where key = p_stage;
  if not found then raise exception 'Unknown stage'; end if;
  if cardinality(p_ids) > 5000 then raise exception 'Too many prospects in one go'; end if;
  if st.system_event then
    if not private.has_staff_role('{admin}') or nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception '“%” is set automatically when it actually happens. An admin can override it with a reason.', st.label;
    end if;
    perform set_config('gfit.crm_override_reason', p_reason, true);
  end if;
  foreach pid in array p_ids loop
    select * into p from public.crm_prospects where id = pid;
    if not found then continue; end if;
    if p.stage = p_stage then continue; end if;
    if p.do_not_contact and st.key not in ('do_not_contact', 'declined', 'not_interested', 'not_suitable', 'no_response') then
      skipped := skipped || jsonb_build_object('id', pid, 'name', p.creator_name, 'reason', 'do-not-contact');
      continue;
    end if;
    update public.crm_prospects set stage = p_stage,
      reason_lost = case when st.kind = 'outcome' and p_reason is not null then left(p_reason, 1000) else reason_lost end
    where id = pid;
    moved := moved + 1;
  end loop;
  perform set_config('gfit.crm_override_reason', '', true);
  return jsonb_build_object('moved', moved, 'skipped', skipped);
end $$;

create or replace function public.crm_bulk_update(p_ids uuid[], p_assign uuid default null, p_unassign boolean default false,
                                                  p_add_tags text[] default '{}', p_remove_tags text[] default '{}')
returns int language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  perform private.crm_require_staff();
  if p_assign is not null and not private.crm_is_staff_user(p_assign) then
    raise exception 'You can only assign prospects to staff';
  end if;
  update public.crm_prospects set
    assigned_to = case when p_unassign then null else coalesce(p_assign, assigned_to) end,
    tags = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(tags || coalesce(p_add_tags, '{}')) x
            where x <> all (coalesce(p_remove_tags, '{}')) and btrim(x) <> '')
  where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

/** A person confirms they sent a message. Logs it, moves the stage forward and schedules the follow-up. */
create or replace function public.crm_log_outreach(p_prospect uuid, p_channel text, p_body text, p_subject text default null,
  p_template uuid default null, p_template_version int default null, p_confirm_permission boolean default false, p_force boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  p public.crm_prospects; q jsonb; aid bigint; tid uuid; n int; due date; last_same timestamptz; pos int;
begin
  perform private.crm_require_staff();
  if p_channel not in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'email', 'contact_form', 'phone', 'website') then
    raise exception 'Unknown channel';
  end if;
  select * into p from public.crm_prospects where id = p_prospect for update;
  if not found then raise exception 'Prospect not found'; end if;
  if p.do_not_contact then raise exception 'This creator is on the do-not-contact list'; end if;
  if p_channel = any (p.unavailable_channels) then raise exception 'That channel is marked unavailable for this creator'; end if;
  if p.outreach_permission_status = 'withdrawn' then raise exception 'This creator asked not to be contacted'; end if;
  if p_channel = 'email' and p.outreach_permission_status = 'unknown' then
    if not p_confirm_permission then
      raise exception 'Before emailing, confirm the address is published for business enquiries' using errcode = 'P0001', hint = 'confirm_permission';
    end if;
    update public.crm_prospects set outreach_permission_status = 'published_business_contact', contact_verified_on = private.crm_today() where id = p.id;
    insert into public.crm_activities (prospect_id, kind, detail)
      values (p.id, 'permission', jsonb_build_object('status', 'published_business_contact', 'source', p.contact_source_url));
  end if;
  select s.queue into q from public.crm_settings s where s.id = 1;
  select max(occurred_at) into last_same from public.crm_activities a
   where a.prospect_id = p.id and a.kind = 'outreach' and a.direction = 'out' and a.channel = p_channel;
  if not p_force and last_same > now() - make_interval(days => coalesce((q ->> 'duplicate_guard_days')::int, 3)) then
    raise exception 'Already contacted on % within the last % days', p_channel, coalesce((q ->> 'duplicate_guard_days')::int, 3)
      using hint = 'duplicate';
  end if;

  insert into public.crm_activities (prospect_id, kind, channel, direction, template_id, template_version, subject, body, detail)
  values (p.id, 'outreach', p_channel, 'out', p_template, p_template_version, left(p_subject, 300), left(p_body, 10000),
          jsonb_build_object('follow_up_number', p.outbound_count))
  returning id into aid;

  select position into pos from public.crm_stages where key = p.stage;
  update public.crm_prospects set
    last_outbound_at = now(), last_contact_at = now(), outbound_count = outbound_count + 1,
    stage = case when p.stage in ('identified', 'qualified', 'ready_for_outreach', 'follow_up_required', 'revisit_later', 'no_response') then 'contacted' else stage end,
    snoozed_until = null
  where id = p.id;

  update public.crm_tasks set status = 'done', completed_at = now(), completed_by = (select auth.uid())
   where prospect_id = p.id and status = 'open' and kind = 'follow_up';

  n := p.outbound_count + 1; -- messages sent so far, including this one
  if p.last_inbound_at is null and n <= coalesce((q ->> 'max_follow_ups')::int, 2) then
    due := private.crm_today() + case when n = 1 then coalesce((q ->> 'first_follow_up_days')::int, 4) else coalesce((q ->> 'second_follow_up_days')::int, 7) end;
    insert into public.crm_tasks (prospect_id, kind, title, follow_up_number, due_on, assigned_to)
    values (p.id, 'follow_up', format('Follow-up %s to %s', n, p.creator_name), n, due, coalesce(p.assigned_to, (select auth.uid())))
    returning id into tid;
  elsif p.last_inbound_at is null then
    due := private.crm_today() + coalesce((q ->> 'second_follow_up_days')::int, 7);
    insert into public.crm_tasks (prospect_id, kind, title, due_on, assigned_to)
    values (p.id, 'custom', format('No reply after %s messages — mark %s as No Response?', n, p.creator_name), due, coalesce(p.assigned_to, (select auth.uid())))
    returning id into tid;
  end if;
  return jsonb_build_object('activity_id', aid, 'task_id', tid, 'follow_up_on', due);
end $$;

/** Record a reply. Positive → Interested; neutral → Responded; negative → Not Interested. Closes follow-ups. */
create or replace function public.crm_record_response(p_prospect uuid, p_sentiment text, p_summary text,
  p_channel text default null, p_objection text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare p public.crm_prospects; target text;
begin
  perform private.crm_require_staff();
  if p_sentiment not in ('positive', 'neutral', 'negative') then raise exception 'Choose positive, neutral or negative'; end if;
  select * into p from public.crm_prospects where id = p_prospect for update;
  if not found then raise exception 'Prospect not found'; end if;
  insert into public.crm_activities (prospect_id, kind, channel, direction, sentiment, body)
    values (p.id, 'reply', p_channel, 'in', p_sentiment, left(p_summary, 10000));
  if nullif(btrim(coalesce(p_objection, '')), '') is not null then
    insert into public.crm_activities (prospect_id, kind, body) values (p.id, 'objection', left(btrim(p_objection), 500));
  end if;
  target := case p_sentiment when 'positive' then 'interested' when 'neutral' then 'responded' else 'not_interested' end;
  update public.crm_prospects set last_inbound_at = now(), last_contact_at = now(),
    stage = case
      when p.do_not_contact then stage
      when (select position from public.crm_stages where key = p.stage) >= (select position from public.crm_stages where key = 'application_invited')
           and (select kind from public.crm_stages where key = p.stage) = 'stage' then stage -- already further along
      when p_sentiment = 'neutral' and p.stage = 'interested' then stage
      else target end
  where id = p.id;
  update public.crm_tasks set status = 'done', completed_at = now(), completed_by = (select auth.uid())
   where prospect_id = p.id and status = 'open' and kind in ('follow_up', 'reply');
  if p_sentiment <> 'negative' and not p.do_not_contact then
    insert into public.crm_tasks (prospect_id, kind, title, due_on, assigned_to)
    values (p.id, 'reply', format('Reply to %s', p.creator_name), private.crm_today(), coalesce(p.assigned_to, (select auth.uid())));
  end if;
end $$;

create or replace function public.crm_add_note(p_prospect uuid, p_body text, p_kind text default 'note')
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  if p_kind not in ('note', 'objection') then raise exception 'Notes or objections only'; end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then raise exception 'The note is empty'; end if;
  insert into public.crm_activities (prospect_id, kind, body) values (p_prospect, p_kind, left(btrim(p_body), 10000));
end $$;

create or replace function public.crm_schedule_task(p_prospect uuid, p_due date, p_title text default null, p_kind text default 'follow_up')
returns uuid language plpgsql security invoker set search_path = '' as $$
declare tid uuid; nm text;
begin
  perform private.crm_require_staff();
  if p_kind not in ('follow_up', 'custom', 'reply') then raise exception 'Unknown task type'; end if;
  select creator_name into nm from public.crm_prospects where id = p_prospect;
  insert into public.crm_tasks (prospect_id, kind, title, due_on, assigned_to)
  values (p_prospect, p_kind, coalesce(nullif(btrim(p_title), ''), format('Follow up with %s', nm)), p_due, (select auth.uid()))
  returning id into tid;
  insert into public.crm_activities (prospect_id, kind, body, detail) values (p_prospect, 'task', coalesce(nullif(btrim(p_title), ''), 'Follow-up scheduled'), jsonb_build_object('due_on', p_due));
  return tid;
end $$;

create or replace function public.crm_task_action(p_task uuid, p_action text, p_until date default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  if p_action = 'done' then
    update public.crm_tasks set status = 'done', completed_at = now(), completed_by = (select auth.uid()) where id = p_task and status = 'open';
  elsif p_action = 'cancel' then
    update public.crm_tasks set status = 'cancelled', completed_at = now(), completed_by = (select auth.uid()) where id = p_task and status = 'open';
  elsif p_action = 'snooze' then
    if p_until is null or p_until <= private.crm_today() then raise exception 'Choose a date after today'; end if;
    update public.crm_tasks set snoozed_until = p_until where id = p_task and status = 'open';
  else raise exception 'Unknown action'; end if;
end $$;

create or replace function public.crm_snooze_prospect(p_prospect uuid, p_until date)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  if p_until is null or p_until <= private.crm_today() then raise exception 'Choose a date after today'; end if;
  update public.crm_prospects set snoozed_until = p_until where id = p_prospect;
end $$;

create or replace function public.crm_set_dnc(p_prospect uuid, p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Give a short reason'; end if;
  update public.crm_prospects set do_not_contact = true, dnc_reason = left(btrim(p_reason), 1000), outreach_permission_status = 'withdrawn'
   where id = p_prospect and not do_not_contact;
  update public.crm_tasks set status = 'cancelled', completed_at = now(), completed_by = (select auth.uid())
   where prospect_id = p_prospect and status = 'open';
end $$;

create or replace function public.crm_clear_dnc(p_prospect uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.crm_prospects;
begin
  if not private.has_staff_role('{admin}') then raise exception 'Only an admin can clear do-not-contact' using errcode = 'insufficient_privilege'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Give the reason (for example, the creator asked to hear from us)'; end if;
  select * into p from public.crm_prospects where id = p_prospect for update;
  if not found or not p.do_not_contact then return; end if;
  delete from public.crm_suppressions where key_hash in (private.crm_hash('instagram', p.key_instagram), private.crm_hash('tiktok', p.key_tiktok),
    private.crm_hash('youtube', p.key_youtube), private.crm_hash('email', p.key_email));
  perform set_config('gfit.crm_clear_dnc', 'on', true);
  update public.crm_prospects set do_not_contact = false, dnc_reason = null, dnc_at = null, stage = 'revisit_later',
    outreach_permission_status = case when outreach_permission_status = 'withdrawn' then 'express_consent' else outreach_permission_status end
   where id = p.id;
  perform set_config('gfit.crm_clear_dnc', '', true);
  insert into public.crm_activities (prospect_id, kind, body, detail, actor_user_id) values (p.id, 'dnc', 'Do-not-contact cleared: ' || p_reason, '{"cleared": true}', (select auth.uid()));
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm', format('Do-not-contact cleared: %s', p.creator_name),
          jsonb_build_object('prospect_id', p.id, 'reason', p_reason));
end $$;
revoke all on function public.crm_clear_dnc(uuid, text) from public, anon;

create or replace function public.crm_set_channel(p_prospect uuid, p_channel text, p_unavailable boolean, p_reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  update public.crm_prospects set unavailable_channels = case when p_unavailable
      then (select array_agg(distinct x) from unnest(unavailable_channels || p_channel) x)
      else array_remove(unavailable_channels, p_channel) end
   where id = p_prospect;
  insert into public.crm_activities (prospect_id, kind, channel, body, detail)
  values (p_prospect, 'channel', p_channel, p_reason, jsonb_build_object('unavailable', p_unavailable));
end $$;

create or replace function public.crm_adjust_score(p_prospect uuid, p_score numeric, p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare before numeric;
begin
  perform private.crm_require_staff();
  if p_score is not null and nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Give a reason for the manual score'; end if;
  select fit_score into before from public.crm_prospects where id = p_prospect;
  update public.crm_prospects set fit_score_manual = p_score, fit_score_manual_reason = case when p_score is null then null else left(btrim(p_reason), 1000) end
   where id = p_prospect;
  insert into public.crm_activities (prospect_id, kind, body, detail)
  values (p_prospect, 'score_adjust', p_reason, jsonb_build_object('from', before, 'manual', p_score));
end $$;

/** Admin-only, audited export of the chosen prospects (the screen turns these rows into a CSV). */
create or replace function public.crm_export_prospects(p_ids uuid[])
returns setof public.crm_prospects language plpgsql security invoker set search_path = '' as $$
begin
  if not private.has_staff_role('{admin}') then raise exception 'Only admins can export prospect data' using errcode = 'insufficient_privilege'; end if;
  perform private.crm_audit(format('Exported %s prospects', cardinality(p_ids)), jsonb_build_object('count', cardinality(p_ids)));
  return query select * from public.crm_prospects where id = any (p_ids) order by ref;
end $$;

create or replace function public.crm_save_template(p_id uuid, p_meta jsonb, p_subject text, p_body text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare tid uuid := p_id; v int; m public.crm_templates;
begin
  perform private.crm_require_staff();
  m := jsonb_populate_record(null::public.crm_templates, p_meta);
  if tid is null then
    insert into public.crm_templates (name, channel, purpose, categories, creator_types, stage, objection, follow_up_number, partnership_type, commercial, active)
    values (m.name, m.channel, m.purpose, coalesce(m.categories, '{}'), coalesce(m.creator_types, '{}'), m.stage, m.objection, m.follow_up_number,
            m.partnership_type, coalesce(m.commercial, true), coalesce(m.active, true))
    returning id into tid;
    v := 1;
  else
    select current_version + 1 into v from public.crm_templates where id = tid for update;
    if v is null then raise exception 'Template not found'; end if;
    update public.crm_templates set name = m.name, channel = m.channel, purpose = m.purpose, categories = coalesce(m.categories, '{}'),
      creator_types = coalesce(m.creator_types, '{}'), stage = m.stage, objection = m.objection, follow_up_number = m.follow_up_number,
      partnership_type = m.partnership_type, commercial = coalesce(m.commercial, true), active = coalesce(m.active, true),
      current_version = v, updated_at = now()
    where id = tid;
  end if;
  insert into public.crm_template_versions (template_id, version, subject, body) values (tid, v, nullif(btrim(p_subject), ''), p_body);
  return tid;
end $$;

