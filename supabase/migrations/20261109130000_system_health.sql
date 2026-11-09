-- System health: errors from the website/app/server functions plus an hourly health check, in one place.
-- Repeated problems are grouped by "fingerprint" (counted, not duplicated). Admins see them in Admin → System health,
-- and new errors are emailed to the alert address once an email service is connected (send-emails function).
create table if not exists public.system_events (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null check (source in ('web', 'mobile', 'function', 'health', 'database')),
  level text not null check (level in ('error', 'warning', 'info')),
  title text not null,
  detail jsonb not null default '{}',
  count int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  alerted_at timestamptz
);
create index if not exists system_events_open on public.system_events (last_at desc) where resolved_at is null;
alter table public.system_events enable row level security;
create policy system_events_read on public.system_events for select using (private.has_staff_role('{admin,support}'::public.staff_role[]));
-- Staff can only mark resolved / reopen (column-limited below).
create policy system_events_resolve on public.system_events for update using (private.has_staff_role('{admin,support}'::public.staff_role[]))
  with check (private.has_staff_role('{admin,support}'::public.staff_role[]));
revoke insert, delete, update on public.system_events from anon, authenticated;
grant update (resolved_at, resolved_by) on public.system_events to authenticated;

-- Record (or re-count) a problem. A resolved problem that happens again is reopened and alerted again.
create or replace function private.record_event(p_source text, p_level text, p_title text, p_detail jsonb, p_fingerprint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.system_events (fingerprint, source, level, title, detail)
  values (left(p_fingerprint, 200), p_source, p_level, left(p_title, 300), coalesce(p_detail, '{}'::jsonb))
  on conflict (fingerprint) do update set
    count = public.system_events.count + 1,
    last_at = now(),
    detail = excluded.detail,
    level = excluded.level,
    alerted_at = case when public.system_events.resolved_at is not null then null else public.system_events.alerted_at end,
    resolved_at = null, resolved_by = null;
end $$;
revoke all on function private.record_event(text, text, text, jsonb, text) from public, anon, authenticated;

-- Server functions report failures here (service role only).
create or replace function public.record_system_event(p_source text, p_level text, p_title text, p_detail jsonb, p_fingerprint text)
returns void language sql security definer set search_path = '' as $$
  select private.record_event(p_source, p_level, p_title, p_detail, p_fingerprint);
$$;
revoke all on function public.record_system_event(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_system_event(text, text, text, jsonb, text) to service_role;

-- The website and app report crashes here. Anyone can call it (crashes happen before sign-in too), so it is
-- tightly limited: short text only, no free-form data, and at most 60 reports a minute in total.
create or replace function public.report_client_error(p_source text, p_message text, p_where text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare recent int; msg text; loc text;
begin
  if p_source not in ('web', 'mobile') then return; end if;
  select coalesce(sum(1), 0) into recent from public.system_events where source in ('web', 'mobile') and last_at > now() - interval '1 minute';
  if recent >= 60 then return; end if;
  -- Strip anything that looks like an email address or a long token before storing.
  msg := regexp_replace(left(coalesce(p_message, 'Unknown error'), 300), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', '[email]', 'g');
  msg := regexp_replace(msg, '[A-Za-z0-9_\-]{32,}', '[token]', 'g');
  loc := regexp_replace(left(coalesce(p_where, ''), 200), '[?#].*$', '');
  perform private.record_event(p_source, 'error', msg, jsonb_build_object('where', loc),
    p_source || ':' || md5(regexp_replace(msg, '\d+', 'N', 'g') || '|' || loc));
end $$;
revoke all on function public.report_client_error(text, text, text) from public;
grant execute on function public.report_client_error(text, text, text) to anon, authenticated;

-- Hourly health check: are the scheduled jobs running and answering, are emails flowing, are payments syncing?
create or replace function private.health_check() returns int language plpgsql security definer set search_path = '' as $$
declare r record; problems int := 0; n int;
begin
  -- 1. Each scheduled job ran recently and succeeded.
  for r in select * from (values ('aggregate-playback', interval '40 minutes'), ('send-emails', interval '30 minutes'),
                                 ('billing-reconcile', interval '26 hours'), ('purge-old-heartbeats', interval '26 hours')) v(job, within) loop
    if not exists (select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                   where j.jobname = r.job and d.status = 'succeeded' and d.start_time > now() - r.within) then
      perform private.record_event('health', 'error', format('Scheduled job "%s" has not run successfully recently', r.job),
        jsonb_build_object('expected_within', r.within::text), 'health:job:' || r.job);
      problems := problems + 1;
    end if;
  end loop;
  -- 2. Scheduled calls to our server functions are being answered (not 4xx/5xx or timeouts).
  select count(*) into n from net._http_response where created > now() - interval '1 hour' and (status_code is null or status_code >= 400);
  if n > 0 then
    perform private.record_event('health', 'warning', format('%s scheduled server call(s) failed in the last hour', n),
      jsonb_build_object('failed', n), 'health:http-failures');
    problems := problems + 1;
  end if;
  -- 3. Emails: none stuck or failed.
  select count(*) into n from public.member_notices where status = 'failed' and created_at > now() - interval '7 days';
  if n > 0 then
    perform private.record_event('health', 'error', format('%s member email(s) failed to send', n), jsonb_build_object('failed', n), 'health:emails-failed');
    problems := problems + 1;
  end if;
  select count(*) into n from public.member_notices where status = 'queued' and due_at < now() - interval '1 hour';
  if n > 0 then
    perform private.record_event('health', 'warning', format('%s member email(s) waiting for over an hour', n), jsonb_build_object('waiting', n), 'health:emails-stuck');
    problems := problems + 1;
  end if;
  -- 4. A month-end is overdue: by the 6th, last month should have a preview.
  if extract(day from now() at time zone 'Australia/Sydney') >= 6 and not exists (
      select 1 from public.month_end_runs where month = to_char((now() at time zone 'Australia/Sydney') - interval '1 month', 'YYYY-MM')) then
    perform private.record_event('health', 'warning', 'Last month’s royalty preview has not been produced',
      '{}'::jsonb, 'health:month-end:' || to_char((now() at time zone 'Australia/Sydney') - interval '1 month', 'YYYY-MM'));
    problems := problems + 1;
  end if;
  return problems;
end $$;
revoke all on function private.health_check() from public, anon, authenticated;

-- Admins can run the check on demand from the System health page.
create or replace function public.run_health_check() returns int language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_staff_role('{admin,support}') then raise exception 'Staff only' using errcode = 'insufficient_privilege'; end if;
  return private.health_check();
end $$;
revoke all on function public.run_health_check() from public, anon;
grant execute on function public.run_health_check() to authenticated;

select cron.schedule('health-check', '7 * * * *', $$ select private.health_check() $$);
