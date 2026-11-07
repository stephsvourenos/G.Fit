-- Preview (never finalise) the previous month on the 1st–5th of each month at 04:13 UTC,
-- so finance sees the numbers waiting. Finalising is always a person's decision.
select cron.schedule(
  'month-end-preview',
  '13 4 1-5 * *',
  $$ select net.http_post(
       url := 'https://iwwnexttdqksrwqafazi.supabase.co/functions/v1/month-end',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-nonce', private.issue_cron_nonce()),
       body := '{"action":"preview"}'::jsonb,
       timeout_milliseconds := 60000
     ) $$
);
