-- Schedules: aggregate qualified minutes every 15 minutes; purge old heartbeats daily.
-- The job proves itself to the Edge Function with a one-time code that expires
-- in 5 minutes, so no long-lived secret is stored anywhere.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists private.cron_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

create or replace function private.issue_cron_nonce()
returns text language plpgsql security definer set search_path = '' as $$
declare n text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from private.cron_nonces where created_at < now() - interval '1 hour';
  insert into private.cron_nonces (nonce) values (n);
  return n;
end;
$$;
revoke execute on function private.issue_cron_nonce() from public, anon, authenticated;

-- Called by the Edge Function (service role only): true once, then the code is gone.
create or replace function public.consume_cron_nonce(n text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from private.cron_nonces where nonce = n and created_at > now() - interval '5 minutes';
  return found;
end;
$$;
revoke execute on function public.consume_cron_nonce(text) from public, anon, authenticated;
grant execute on function public.consume_cron_nonce(text) to service_role;

select cron.schedule(
  'aggregate-playback',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://iwwnexttdqksrwqafazi.supabase.co/functions/v1/aggregate-playback',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-nonce', private.issue_cron_nonce()),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     ) $$
);

select cron.schedule('purge-old-heartbeats', '17 3 * * *', $$ select private.purge_old_heartbeats() $$);
