-- Creator Acquisition CRM, part 3 of 4: Today's Tasks queue, dashboard and analytics.

-- ---------------------------------------------------------------------------------------------------------------
-- Today's Tasks: the daily outreach queue and the work that is due
-- ---------------------------------------------------------------------------------------------------------------
/** The best channel we're allowed to use for a prospect, or null. Email needs permission to be known or confirmable. */
create or replace function private.crm_channel(p public.crm_prospects) returns text
language sql stable set search_path = '' as $$
  select c from (values
      (0, p.preferred_outreach_channel),
      (1, 'instagram'), (2, 'tiktok'), (3, 'email'), (4, 'facebook'), (5, 'linkedin'), (6, 'contact_form'), (7, 'youtube')) v(o, c)
  where c is not null and c <> all (p.unavailable_channels)
    and p.outreach_permission_status <> 'withdrawn'
    and case c when 'instagram' then p.instagram_url is not null when 'tiktok' then p.tiktok_url is not null
               when 'email' then p.public_business_email is not null when 'facebook' then p.facebook_url is not null
               when 'linkedin' then p.linkedin_url is not null when 'contact_form' then p.contact_form_url is not null
               when 'youtube' then p.youtube_url is not null else false end
  order by o limit 1
$$;

create or replace function private.crm_card(p public.crm_prospects) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'ref', p.ref, 'creator_name', p.creator_name, 'business_name', p.business_name,
    'country', p.country, 'primary_category', p.primary_category, 'allocation_category', p.allocation_category,
    'primary_platform', p.primary_platform, 'followers', coalesce(p.estimated_combined_followers,
      nullif(coalesce(p.instagram_followers, 0) + coalesce(p.tiktok_followers, 0) + coalesce(p.youtube_subscribers, 0) + coalesce(p.facebook_followers, 0), 0)),
    'fit_score', p.fit_score, 'fit_tier', p.fit_tier, 'confidence_level', p.confidence_level, 'stage', p.stage,
    'last_contact_at', p.last_contact_at, 'assigned_to', p.assigned_to, 'channel', private.crm_channel(p),
    'instagram_url', p.instagram_url, 'tiktok_url', p.tiktok_url, 'youtube_url', p.youtube_url, 'facebook_url', p.facebook_url,
    'linkedin_url', p.linkedin_url, 'website_url', p.website_url, 'contact_form_url', p.contact_form_url,
    'public_business_email', p.public_business_email, 'outreach_permission_status', p.outreach_permission_status,
    'personalised_initial_dm', p.personalised_initial_dm, 'personalised_initial_email', p.personalised_initial_email,
    'specific_personalisation_detail', p.specific_personalisation_detail, 'recommended_pitch_angle', p.recommended_pitch_angle,
    'why_gfit_is_relevant', p.why_gfit_is_relevant, 'outbound_count', p.outbound_count, 'last_inbound_at', p.last_inbound_at,
    'full_length_workouts_available', p.full_length_workouts_available, 'do_not_contact', p.do_not_contact,
    'unavailable_channels', p.unavailable_channels)
$$;

/** Prospects ready for first contact, best first, each with the reasons it was picked. */
create or replace function public.crm_outreach_queue(p_limit int default null)
returns table (prospect jsonb, priority numeric, reasons text[])
language plpgsql stable security invoker set search_path = '' as $$
declare
  lim int; cats jsonb; today date := private.crm_today();
begin
  perform private.crm_require_staff();
  select coalesce(p_limit, (s.queue ->> 'new_per_day')::int, 50), s.categories into lim, cats from public.crm_settings s where s.id = 1;
  return query
  with gaps as (
    select c ->> 'name' as name, greatest(0, (c ->> 'target')::numeric - coalesce(x.n, 0)) / nullif((c ->> 'target')::numeric, 0) as gap
    from jsonb_array_elements(cats) c
    left join (select p.allocation_category, count(*) n from public.crm_prospects p
               where exists (select 1 from public.crm_stage_reached r join public.crm_stages s on s.key = r.stage
                             where r.prospect_id = p.id and s.kind = 'stage'
                               and s.position >= (select position from public.crm_stages where key = 'interested')) group by 1) x on x.allocation_category = c ->> 'name'
  ), cand as (
    select p as pr, private.crm_channel(p) as ch, coalesce(g.gap, 0) as gap
    from public.crm_prospects p
    join public.crm_stages s on s.key = p.stage and s.queue = 'new'
    left join gaps g on g.name = p.allocation_category
    where not p.do_not_contact and p.outbound_count = 0 and (p.snoozed_until is null or p.snoozed_until <= today)
  ), scored as (
    select c.pr, c.gap,
      round(coalesce((c.pr).fit_score, 40) * 0.6
        + case (c.pr).confidence_level when 'high' then 10 when 'medium' then 5 when 'low' then 0 else 2 end
        + c.gap * 12
        + case when (c.pr).full_length_workouts_available then 8 else 0 end
        + least(8, greatest(0, (log(coalesce((c.pr).estimated_combined_followers, coalesce((c.pr).instagram_followers, 0)
              + coalesce((c.pr).tiktok_followers, 0) + coalesce((c.pr).youtube_subscribers, 0))::numeric + 1) - 3) * 2.7))
        + case when (c.pr).personalised_initial_dm is not null or (c.pr).personalised_initial_email is not null then 4 else 0 end
        + case (c.pr).stage when 'ready_for_outreach' then 6 when 'qualified' then 3 else 0 end, 1) as pri
    from cand c where c.ch is not null
  )
  select private.crm_card(x.pr), x.pri,
    array_remove(array[
      case when (x.pr).fit_score is not null then format('Fit %s (tier %s)', (x.pr).fit_score, (x.pr).fit_tier) else 'No fit score yet' end,
      case when (x.pr).confidence_level is not null then format('%s confidence', initcap((x.pr).confidence_level)) end,
      case when x.gap > 0.5 then format('%s still needs creators', (x.pr).allocation_category) end,
      case when (x.pr).full_length_workouts_available then 'Has full-length workouts' end,
      case when (x.pr).personalised_initial_dm is not null or (x.pr).personalised_initial_email is not null then 'Prepared message ready' end,
      case when (x.pr).stage = 'ready_for_outreach' then 'Marked ready for outreach' end], null)
  from scored x
  order by x.pri desc, (x.pr).ref
  limit lim;
end $$;

/** Everything due today, in one call. */
create or replace function public.crm_today_tasks()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare today date := private.crm_today(); fu int; res jsonb;
begin
  perform private.crm_require_staff();
  select coalesce((s.queue ->> 'follow_ups_per_day')::int, 30) into fu from public.crm_settings s where s.id = 1;
  select jsonb_build_object(
    'today', today,
    'follow_ups', coalesce((select jsonb_agg(x.j order by x.urgent desc, x.score desc nulls last) from (
        select jsonb_build_object('task', to_jsonb(t), 'prospect', private.crm_card(p)) j, (t.due_on < today) urgent, p.fit_score score
        from public.crm_tasks t join public.crm_prospects p on p.id = t.prospect_id
        where t.status = 'open' and t.kind = 'follow_up' and t.due_on <= today and (t.snoozed_until is null or t.snoozed_until <= today)
          and not p.do_not_contact
        order by (t.due_on < today) desc, p.fit_score desc nulls last limit fu) x), '[]'),
    'follow_ups_total', (select count(*) from public.crm_tasks t join public.crm_prospects p on p.id = t.prospect_id
        where t.status = 'open' and t.kind = 'follow_up' and t.due_on <= today and (t.snoozed_until is null or t.snoozed_until <= today) and not p.do_not_contact),
    'replies', coalesce((select jsonb_agg(jsonb_build_object('task', to_jsonb(t), 'prospect', private.crm_card(p)) order by p.fit_score desc nulls last)
        from public.crm_tasks t join public.crm_prospects p on p.id = t.prospect_id
        where t.status = 'open' and t.kind = 'reply' and (t.snoozed_until is null or t.snoozed_until <= today) and not p.do_not_contact), '[]'),
    'overdue', coalesce((select jsonb_agg(jsonb_build_object('task', to_jsonb(t), 'prospect', case when p.id is null then null else private.crm_card(p) end) order by t.due_on)
        from public.crm_tasks t left join public.crm_prospects p on p.id = t.prospect_id
        where t.status = 'open' and t.kind <> 'follow_up' and t.due_on < today and (t.snoozed_until is null or t.snoozed_until <= today)), '[]'),
    'custom', coalesce((select jsonb_agg(jsonb_build_object('task', to_jsonb(t), 'prospect', case when p.id is null then null else private.crm_card(p) end) order by t.due_on)
        from public.crm_tasks t left join public.crm_prospects p on p.id = t.prospect_id
        where t.status = 'open' and t.kind = 'custom' and t.due_on = today and (t.snoozed_until is null or t.snoozed_until <= today)), '[]'),
    'content_awaiting_approval', (select count(*) from public.workouts w where w.state = 'awaiting-review')
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Dashboard and analytics
-- ---------------------------------------------------------------------------------------------------------------
/** Funnel milestones: a prospect has "reached" a milestone if it ever reached that stage or any later pipeline stage. */
create or replace function private.crm_reached(p_id uuid, p_milestone text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.crm_stage_reached r join public.crm_stages s on s.key = r.stage
                 where r.prospect_id = p_id and s.kind = 'stage'
                   and s.position >= (select position from public.crm_stages where key = p_milestone))
$$;

create or replace function public.crm_dashboard()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare today date := private.crm_today(); t jsonb; res jsonb; first_at timestamptz;
begin
  perform private.crm_require_staff();
  select s.targets into t from public.crm_settings s where s.id = 1;
  with pos as (
    select max(position) filter (where key = 'qualified') q, max(position) filter (where key = 'contacted') c,
      max(position) filter (where key = 'responded') r, max(position) filter (where key = 'interested') i,
      max(position) filter (where key = 'application_submitted') a, max(position) filter (where key = 'approved') ap,
      max(position) filter (where key = 'agreement_accepted') ag, max(position) filter (where key = 'onboarding') o,
      max(position) filter (where key = 'launch_ready') l
    from public.crm_stages
  ), reach as (
    select r.prospect_id, max(s.position) mx from public.crm_stage_reached r join public.crm_stages s on s.key = r.stage and s.kind = 'stage' group by 1
  ), pos_replies as (
    select distinct a.prospect_id from public.crm_activities a where a.kind = 'reply' and a.sentiment = 'positive'
  ), m as (
    select p.*,
      coalesce(x.mx, 0) >= pos.q or p.fit_tier in ('A', 'B', 'C') as is_qualified,
      coalesce(x.mx, 0) >= pos.c or p.outbound_count > 0 as is_contacted,
      p.last_inbound_at is not null or coalesce(x.mx, 0) >= pos.r as is_responded,
      coalesce(x.mx, 0) >= pos.i or pr.prospect_id is not null as is_positive,
      coalesce(x.mx, 0) >= pos.a as is_applied,
      coalesce(x.mx, 0) >= pos.ap as is_approved,
      coalesce(x.mx, 0) >= pos.ag as is_signed,
      coalesce(x.mx, 0) >= pos.o as is_onboarding,
      coalesce(x.mx, 0) >= pos.l as is_launch_ready,
      private.crm_channel(p) is not null as has_channel
    from public.crm_prospects p cross join pos
    left join reach x on x.prospect_id = p.id
    left join pos_replies pr on pr.prospect_id = p.id
  )
  select jsonb_build_object(
    'today', today,
    'targets', t,
    'days_to_launch', ((t ->> 'launch_date')::date - today),
    'total', (select count(*) from m),
    'new_today', (select count(*) from m where (created_at at time zone 'Australia/Sydney')::date = today),
    'qualified', (select count(*) from m where is_qualified and stage <> 'not_suitable'),
    'contacted', (select count(*) from m where is_contacted),
    'responded', (select count(*) from m where is_responded),
    'positive', (select count(*) from m where is_positive),
    'applied', (select count(*) from m where is_applied),
    'approved', (select count(*) from m where is_approved),
    'signed', (select count(*) from m where is_signed),
    'onboarding', (select count(*) from m where stage in ('onboarding', 'awaiting_content', 'content_under_review')),
    'launch_ready', (select count(*) from m where is_launch_ready),
    'do_not_contact', (select count(*) from m where do_not_contact),
    'by_stage', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from m group by stage) x),
    'by_country', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'total', n, 'contacted', c, 'signed', s) order by n desc), '[]') from (
        select coalesce(country, 'Unknown') k, count(*) n, count(*) filter (where is_contacted) c, count(*) filter (where is_signed) s from m group by 1 order by 2 desc limit 12) x),
    'by_source', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'total', n, 'contacted', c, 'signed', s) order by n desc), '[]') from (
        select coalesce(original_recruitment_source, 'Unknown') k, count(*) n, count(*) filter (where is_contacted) c, count(*) filter (where is_signed) s from m group by 1 order by 2 desc limit 12) x),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('name', c ->> 'name', 'target', (c ->> 'target')::int,
        'qualified', coalesce(g.qualified, 0), 'contacted', coalesce(g.contacted, 0), 'interested', coalesce(g.interested, 0),
        'signed', coalesce(g.signed, 0), 'launch_ready', coalesce(g.launch_ready, 0)) order by o), '[]')
        from jsonb_array_elements((select categories from public.crm_settings where id = 1)) with ordinality e(c, o)
        left join (select allocation_category k, count(*) filter (where is_qualified and stage <> 'not_suitable') qualified,
                     count(*) filter (where is_contacted) contacted, count(*) filter (where is_positive) interested,
                     count(*) filter (where is_signed) signed, count(*) filter (where is_launch_ready) launch_ready
                   from m group by 1) g on g.k = c ->> 'name'),
    'uncategorised', (select count(*) from m where allocation_category is null),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'added', a, 'contacted', c, 'replies', r) order by d), '[]') from (
        select d::date, (select count(*) from public.crm_prospects p where (p.created_at at time zone 'Australia/Sydney')::date = d) a,
          (select count(distinct a.prospect_id) from public.crm_activities a where a.kind = 'outreach' and (a.occurred_at at time zone 'Australia/Sydney')::date = d) c,
          (select count(distinct a.prospect_id) from public.crm_activities a where a.kind = 'reply' and (a.occurred_at at time zone 'Australia/Sydney')::date = d) r
        from generate_series(today - 29, today, interval '1 day') d) x),
    'overdue_follow_ups', (select count(*) from public.crm_tasks k join public.crm_prospects p on p.id = k.prospect_id
        where k.status = 'open' and k.kind = 'follow_up' and k.due_on < today and not p.do_not_contact),
    'incomplete_research', (select count(*) from m where stage in ('identified', 'qualified', 'ready_for_outreach') and not do_not_contact
        and (allocation_category is null or fit_score is null or not has_channel)),
    'no_channel', (select count(*) from m where not do_not_contact and outbound_count = 0 and not has_channel),
    'launch_ready_last_14', (select count(*) from public.crm_stage_reached r where r.stage = 'launch_ready' and r.first_at > now() - interval '14 days'),
    'signed_last_14', (select count(*) from public.crm_stage_reached r where r.stage = 'agreement_accepted' and r.first_at > now() - interval '14 days'),
    'contacted_last_7', (select count(distinct prospect_id) from public.crm_activities a where a.kind = 'outreach' and a.occurred_at > now() - interval '7 days'),
    'first_activity_at', (select min(created_at) from public.crm_prospects),
    -- existing creators and content (counted from the real catalogue, not the CRM)
    'published_workouts', (select count(*) from public.workouts w where w.state = 'published'),
    'creators_with_min_workouts', (select count(*) from (select w.creator_id from public.workouts w where w.state = 'published'
        group by 1 having count(*) >= coalesce((t ->> 'min_approved_workouts')::int, 5)) x),
    'creators_with_any_workout', (select count(distinct w.creator_id) from public.workouts w where w.state = 'published')
  ) into res;
  return res;
end $$;

/** Conversion funnel for prospects first added in a date range, grouped by one dimension. Distinct prospects only. */
create or replace function public.crm_funnel(p_from date, p_to date, p_group text default 'all')
returns table (grp text, prospects bigint, contacted bigint, responded bigint, interested bigint, applied bigint,
               approved bigint, signed bigint, launch_ready bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  if p_group not in ('all', 'source', 'platform', 'category', 'country', 'tier', 'assigned', 'batch', 'template') then
    raise exception 'Unknown grouping';
  end if;
  return query
  with base as (
    select p.*,
      case p_group
        when 'all' then 'All prospects'
        when 'source' then coalesce(p.original_recruitment_source, 'Unknown')
        when 'platform' then coalesce(p.primary_platform, 'Unknown')
        when 'category' then coalesce(p.allocation_category, 'Uncategorised')
        when 'country' then coalesce(p.country, 'Unknown')
        when 'tier' then coalesce('Tier ' || p.fit_tier, 'No score')
        when 'assigned' then coalesce(private.crm_user_email(p.assigned_to), 'Unassigned')
        when 'batch' then coalesce((select b.file_name || ' (' || to_char(b.created_at at time zone 'Australia/Sydney', 'DD Mon') || ')' from public.crm_import_batches b where b.id = p.import_batch_id), 'Added by hand')
        when 'template' then coalesce((select coalesce(t.name, 'Own message') from public.crm_activities a left join public.crm_templates t on t.id = a.template_id
                                       where a.prospect_id = p.id and a.kind = 'outreach' order by a.occurred_at limit 1), 'Not contacted')
      end as g
    from public.crm_prospects p
    where (p.created_at at time zone 'Australia/Sydney')::date between p_from and p_to
  )
  , pos as (
    select max(position) filter (where key = 'contacted') c, max(position) filter (where key = 'responded') r,
      max(position) filter (where key = 'interested') i, max(position) filter (where key = 'application_submitted') a,
      max(position) filter (where key = 'approved') ap, max(position) filter (where key = 'agreement_accepted') ag,
      max(position) filter (where key = 'launch_ready') l
    from public.crm_stages
  ), reach as (
    select r.prospect_id, max(s.position) mx from public.crm_stage_reached r join public.crm_stages s on s.key = r.stage and s.kind = 'stage' group by 1
  )
  select b.g, count(*),
    count(*) filter (where coalesce(x.mx, 0) >= pos.c or b.outbound_count > 0),
    count(*) filter (where b.last_inbound_at is not null or coalesce(x.mx, 0) >= pos.r),
    count(*) filter (where coalesce(x.mx, 0) >= pos.i),
    count(*) filter (where coalesce(x.mx, 0) >= pos.a),
    count(*) filter (where coalesce(x.mx, 0) >= pos.ap),
    count(*) filter (where coalesce(x.mx, 0) >= pos.ag),
    count(*) filter (where coalesce(x.mx, 0) >= pos.l)
  from base b cross join pos left join reach x on x.prospect_id = b.id group by b.g order by count(*) desc;
end $$;

create or replace function public.crm_insights(p_from date, p_to date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform private.crm_require_staff();
  return jsonb_build_object(
    'avg_days_to_first_reply', (select round(avg(extract(epoch from (r.at - o.at)) / 86400)::numeric, 1) from (
        select a.prospect_id, min(a.occurred_at) at from public.crm_activities a where a.kind = 'outreach' group by 1) o
        join (select a.prospect_id, min(a.occurred_at) at from public.crm_activities a where a.kind = 'reply' group by 1) r
          on r.prospect_id = o.prospect_id and r.at > o.at
        join public.crm_prospects p on p.id = o.prospect_id and (p.created_at at time zone 'Australia/Sydney')::date between p_from and p_to),
    'replied_after_contact', (select count(*) from (select a.prospect_id from public.crm_activities a join public.crm_prospects p on p.id = a.prospect_id
        where a.kind = 'reply' and (p.created_at at time zone 'Australia/Sydney')::date between p_from and p_to group by 1) x),
    'avg_days_contact_to_agreement', (select round(avg(extract(epoch from (r.first_at - o.at)) / 86400)::numeric, 1) from (
        select a.prospect_id, min(a.occurred_at) at from public.crm_activities a where a.kind = 'outreach' group by 1) o
        join public.crm_stage_reached r on r.prospect_id = o.prospect_id and r.stage = 'agreement_accepted'),
    'objections', (select coalesce(jsonb_agg(jsonb_build_object('text', k, 'n', n) order by n desc), '[]') from (
        select lower(btrim(a.body)) k, count(distinct a.prospect_id) n from public.crm_activities a
        where a.kind = 'objection' and (a.occurred_at at time zone 'Australia/Sydney')::date between p_from and p_to group by 1 order by 2 desc limit 10) x),
    'reasons_lost', (select coalesce(jsonb_agg(jsonb_build_object('text', k, 'n', n) order by n desc), '[]') from (
        select coalesce(nullif(lower(btrim(p.reason_lost)), ''), '(no reason given) ' || s.label) k, count(*) n
        from public.crm_prospects p join public.crm_stages s on s.key = p.stage
        where s.kind = 'outcome' and (p.stage_changed_at at time zone 'Australia/Sydney')::date between p_from and p_to group by 1 order by 2 desc limit 10) x),
    'messages_sent', (select count(*) from public.crm_activities a where a.kind = 'outreach' and (a.occurred_at at time zone 'Australia/Sydney')::date between p_from and p_to),
    'prospects_messaged', (select count(distinct a.prospect_id) from public.crm_activities a where a.kind = 'outreach' and (a.occurred_at at time zone 'Australia/Sydney')::date between p_from and p_to)
  );
end $$;

revoke all on function public.crm_import_commit(uuid, jsonb), public.crm_import_finish(uuid, jsonb), public.crm_match_index(bigint),
  public.crm_update_prospect(uuid, jsonb, jsonb), public.crm_set_stage(uuid[], text, text),
  public.crm_bulk_update(uuid[], uuid, boolean, text[], text[]), public.crm_log_outreach(uuid, text, text, text, uuid, int, boolean, boolean),
  public.crm_record_response(uuid, text, text, text, text), public.crm_add_note(uuid, text, text), public.crm_schedule_task(uuid, date, text, text),
  public.crm_task_action(uuid, text, date), public.crm_snooze_prospect(uuid, date), public.crm_set_dnc(uuid, text),
  public.crm_set_channel(uuid, text, boolean, text), public.crm_adjust_score(uuid, numeric, text), public.crm_export_prospects(uuid[]),
  public.crm_save_template(uuid, jsonb, text, text), public.crm_outreach_queue(int), public.crm_today_tasks(), public.crm_dashboard(),
  public.crm_funnel(date, date, text), public.crm_insights(date, date) from public, anon;
grant execute on function public.crm_import_commit(uuid, jsonb), public.crm_import_finish(uuid, jsonb), public.crm_match_index(bigint),
  public.crm_update_prospect(uuid, jsonb, jsonb), public.crm_set_stage(uuid[], text, text),
  public.crm_bulk_update(uuid[], uuid, boolean, text[], text[]), public.crm_log_outreach(uuid, text, text, text, uuid, int, boolean, boolean),
  public.crm_record_response(uuid, text, text, text, text), public.crm_add_note(uuid, text, text), public.crm_schedule_task(uuid, date, text, text),
  public.crm_task_action(uuid, text, date), public.crm_snooze_prospect(uuid, date), public.crm_set_dnc(uuid, text), public.crm_clear_dnc(uuid, text),
  public.crm_set_channel(uuid, text, boolean, text), public.crm_adjust_score(uuid, numeric, text), public.crm_export_prospects(uuid[]),
  public.crm_save_template(uuid, jsonb, text, text), public.crm_outreach_queue(int), public.crm_today_tasks(), public.crm_dashboard(),
  public.crm_funnel(date, date, text), public.crm_insights(date, date) to authenticated;
revoke execute on function private.crm_channel(public.crm_prospects), private.crm_card(public.crm_prospects), private.crm_reached(uuid, text) from public, anon;
grant execute on function private.crm_channel(public.crm_prospects), private.crm_card(public.crm_prospects), private.crm_reached(uuid, text) to authenticated;

-- Staff list for assignment menus (emails of staff only; staff-only).
create or replace function public.crm_staff_list()
returns table (user_id uuid, email text, roles text[])
language sql stable security definer set search_path = '' as $$
  select s.user_id, u.email::text, array_agg(s.role::text order by s.role::text)
  from public.staff_members s join auth.users u on u.id = s.user_id
  where private.has_staff_role('{admin,recruiter}')
  group by s.user_id, u.email
$$;
revoke all on function public.crm_staff_list() from public, anon;
grant execute on function public.crm_staff_list() to authenticated;

