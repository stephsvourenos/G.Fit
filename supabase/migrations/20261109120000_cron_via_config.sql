-- Scheduled jobs call this project's own server functions. The address used to be written into each job,
-- which would make a production copy call the development project. It now comes from one setting.
create table if not exists private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.app_config from public, anon, authenticated;

-- Each environment sets its own address once (not in this file, so a copy can never call another project):
--   insert into private.app_config values ('functions_url', 'https://<project-ref>.supabase.co/functions/v1')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- Until it is set, scheduled jobs do nothing (and log a warning).

-- Calls one of our server functions from a scheduled job, with a single-use nonce for authentication.
create or replace function private.call_function(fn text, body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  select value into base from private.app_config where key = 'functions_url';
  if base is null then
    raise warning 'private.app_config functions_url is not set — scheduled call to % skipped', fn;
    return null;
  end if;
  return net.http_post(
    url := base || '/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-nonce', private.issue_cron_nonce()),
    body := body,
    timeout_milliseconds := 60000);
end $$;
revoke all on function private.call_function(text, jsonb) from public, anon, authenticated;

-- Re-point every job at the setting (same names, so these replace the old definitions).
select cron.schedule('aggregate-playback', '*/15 * * * *', $$ select private.call_function('aggregate-playback') $$);
select cron.schedule('billing-reconcile', '41 2 * * *', $$ select private.call_function('billing-reconcile') $$);
select cron.schedule('month-end-preview', '13 4 1-5 * *', $$ select private.call_function('month-end', '{"action":"preview"}'::jsonb) $$);
select cron.schedule('send-emails', '*/10 * * * *', $$ select private.call_function('send-emails') $$);
