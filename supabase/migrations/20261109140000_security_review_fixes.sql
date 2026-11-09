-- Security review (9 Nov 2026) follow-ups.

-- Crash reports: besides 60 a minute, at most 500 NEW problem types a day from the website/app, so a script
-- spamming random messages can't fill the table. Repeats of known problems still just increase the count.
create or replace function public.report_client_error(p_source text, p_message text, p_where text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare recent int; today int; msg text; loc text;
begin
  if p_source not in ('web', 'mobile') then return; end if;
  select count(*) into recent from public.system_events where source in ('web', 'mobile') and last_at > now() - interval '1 minute';
  if recent >= 60 then return; end if;
  msg := regexp_replace(left(coalesce(p_message, 'Unknown error'), 300), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', '[email]', 'g');
  msg := regexp_replace(msg, '[A-Za-z0-9_\-]{32,}', '[token]', 'g');
  loc := regexp_replace(left(coalesce(p_where, ''), 200), '[?#].*$', '');
  select count(*) into today from public.system_events where source in ('web', 'mobile') and first_at > now() - interval '1 day';
  if today >= 500 and not exists (select 1 from public.system_events
      where fingerprint = p_source || ':' || md5(regexp_replace(msg, '\d+', 'N', 'g') || '|' || loc)) then
    return;
  end if;
  perform private.record_event(p_source, 'error', msg, jsonb_build_object('where', loc),
    p_source || ':' || md5(regexp_replace(msg, '\d+', 'N', 'g') || '|' || loc));
end $$;
revoke all on function public.report_client_error(text, text, text) from public;
grant execute on function public.report_client_error(text, text, text) to anon, authenticated;
