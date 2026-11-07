-- v2: bank file required before export; creator bank details security.
create or replace function tests.run_finance_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  f1 uuid := gen_random_uuid();  -- finance person 1 (maker)
  f2 uuid := gen_random_uuid();  -- finance person 2 (checker)
  uc uuid := gen_random_uuid();  -- creator X's login
  up uuid := gen_random_uuid();  -- a parent
  cx uuid; cy uuid; b1 uuid; b2 uuid; b3 uuid;
  m1 text := '2990-01'; m2 text := '2990-02';
  run jsonb; n int; t text; passed int := 0; failed text := '';
begin
  insert into auth.users (id, email, aud, role) values
    (f1, 'f1@test.invalid', 'authenticated', 'authenticated'), (f2, 'f2@test.invalid', 'authenticated', 'authenticated'),
    (uc, 'cx@test.invalid', 'authenticated', 'authenticated'), (up, 'p@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_members (user_id, role) values (f1, 'finance'), (f2, 'finance');
  insert into public.creators (display_name, legal_name, referral_code) values ('TEST X', 'X', 'TESTX') returning id into cx;
  insert into public.creators (display_name, legal_name, referral_code) values ('TEST Y', 'Y', 'TESTY') returning id into cy;
  insert into public.creator_users (creator_id, user_id) values (cx, uc);

  -- ---------- finalise a month: run + ledger + statements in one step ----------
  run := jsonb_build_object('run_id', 'run-'||m1||'-final', 'month', m1, 'policy_versions', '{}'::jsonb,
    'net_receipts_minor', 100000, 'royalty_pool_minor', 30000, 'royalty_allocated_minor', 30000, 'royalty_retained_minor', 0,
    'referral_minor', 1500, 'adjustments_minor', 0, 'entry_count', 3, 'fingerprint', 'abc', 'created_by', 'test');
  perform public.finalise_month_end(run,
    jsonb_build_array(
      jsonb_build_object('id','t:roy:x1','creator_id',cx,'kind','royalty','amount_minor',25000,'currency','AUD','earning_month',m1,'source_refs','[]'::jsonb,'contract_ref','c','memo','m'),
      jsonb_build_object('id','t:ref:x1','creator_id',cx,'kind','referral','amount_minor',1500,'currency','AUD','earning_month',m1,'source_refs','[]'::jsonb,'contract_ref','c','memo','m'),
      jsonb_build_object('id','t:roy:y1','creator_id',cy,'kind','royalty','amount_minor',5000,'currency','AUD','earning_month',m1,'source_refs','[]'::jsonb,'contract_ref','c','memo','m')),
    jsonb_build_array(
      jsonb_build_object('creator_id',cx,'opening_balance_minor',0,'royalties_minor',25000,'referrals_minor',1500,'adjustments_minor',0,'paid_out_minor',0,'closing_balance_minor',26500,'payable_minor',26500,'carried_forward_minor',0,'next_pay_date','2990-04-15'),
      jsonb_build_object('creator_id',cy,'opening_balance_minor',0,'royalties_minor',5000,'referrals_minor',0,'adjustments_minor',0,'paid_out_minor',0,'closing_balance_minor',5000,'payable_minor',0,'carried_forward_minor',5000,'next_pay_date','2990-04-15')));
  select count(*) into n from public.ledger_entries where earning_month = m1;
  if n = 3 then passed := passed + 1; else failed := failed || ' [final writes 3 ledger entries]'; end if;
  select count(*) into n from public.creator_statements where month = m1 and carried_forward_minor = 5000 and payable_minor = 0 and creator_id = cy;
  if n = 1 then passed := passed + 1; else failed := failed || ' [under-minimum balance carried forward, not payable]'; end if;

  begin perform public.finalise_month_end(run, '[]'::jsonb, '[]'::jsonb); failed := failed || ' [month finalised twice]';
  exception when others then passed := passed + 1; end;
  begin
    perform public.finalise_month_end(jsonb_set(jsonb_set(run, '{month}', '"2989-12"'), '{run_id}', '"r-old"'), '[]'::jsonb, '[]'::jsonb);
    failed := failed || ' [finalised an earlier month after a later one]';
  exception when others then passed := passed + 1; end;
  begin update public.ledger_entries set amount_minor = 1 where id = 't:roy:x1'; failed := failed || ' [ledger edited]';
  exception when others then passed := passed + 1; end;
  begin delete from public.ledger_entries where id = 't:roy:x1'; failed := failed || ' [ledger deleted]';
  exception when others then passed := passed + 1; end;
  begin update public.creator_statements set payable_minor = 1 where creator_id = cx; failed := failed || ' [statement edited]';
  exception when others then passed := passed + 1; end;
  begin delete from public.month_end_runs where month = m1; failed := failed || ' [final run deleted]';
  exception when others then passed := passed + 1; end;
  insert into public.month_end_runs (run_id, month, status, policy_versions, net_receipts_minor, royalty_pool_minor,
    royalty_allocated_minor, royalty_retained_minor, referral_minor, adjustments_minor, entry_count, fingerprint)
    values ('t-prov', m2, 'provisional', '{}', 0, 0, 0, 0, 0, 0, 0, 'p');
  delete from public.month_end_runs where run_id = 't-prov';
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || ' [preview can be replaced]'; end if;

  -- ---------- payouts: no entry paid twice ----------
  b1 := public.create_payout_batch(jsonb_build_array(jsonb_build_object('creator_id', cx, 'amount_minor', 26500,
          'entry_ids', jsonb_build_array('t:roy:x1','t:ref:x1'))), f1, 'test');
  begin
    perform public.create_payout_batch(jsonb_build_array(jsonb_build_object('creator_id', cx, 'amount_minor', 25000,
          'entry_ids', jsonb_build_array('t:roy:x1'))), f1, 'dup');
    failed := failed || ' [same entry in two batches]';
  exception when others then passed := passed + 1; end;
  begin
    perform public.create_payout_batch(jsonb_build_array(jsonb_build_object('creator_id', cy, 'amount_minor', 9999,
          'entry_ids', jsonb_build_array('t:roy:y1'))), f1, 'wrong amount');
    failed := failed || ' [amount not matching entries accepted]';
  exception when others then passed := passed + 1; end;

  -- ---------- as finance person 1 (who made the batch) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', f1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.payout_batch_action(b1, 'approve'); failed := failed || ' [maker approved own batch]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- ---------- as finance person 2 (checker) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', f2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.payout_batch_action(b1, 'confirm', 'REF1', 26500); failed := failed || ' [confirmed before approval/export]';
  exception when others then passed := passed + 1; end;
  perform public.payout_batch_action(b1, 'approve'); passed := passed + 1;
  begin perform public.payout_batch_action(b1, 'export'); failed := failed || ' [exported without a bank file]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);
  perform public.payout_record_export(b1, 'ABA-TEST', 'sha', '2990-04-15', f2);   -- what the server does
  select count(*) into n from public.payout_batches where id = b1 and status = 'exported' and aba_text is not null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [bank file recorded + exported]'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', f2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.payout_batch_action(b1, 'confirm', '', 26500); failed := failed || ' [paid without bank reference]';
  exception when others then passed := passed + 1; end;
  begin perform public.payout_batch_action(b1, 'confirm', 'REF1', 26000); failed := failed || ' [paid with wrong amount]';
  exception when others then passed := passed + 1; end;
  perform public.payout_batch_action(b1, 'confirm', 'BANK-REF-001', 26500);
  select status into t from public.payout_batches where id = b1;
  if t = 'confirmed' then passed := passed + 1; else failed := failed || ' [confirm with proof]'; end if;
  begin perform public.payout_batch_action(b1, 'cancel', null, null, 'oops'); failed := failed || ' [paid batch cancelled]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- A cancelled batch releases its entries so they can be paid later (once).
  b2 := public.create_payout_batch(jsonb_build_array(jsonb_build_object('creator_id', cy, 'amount_minor', 5000,
          'entry_ids', jsonb_build_array('t:roy:y1'))), f1, 'y');
  perform set_config('request.jwt.claims', json_build_object('sub', f2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.payout_batch_action(b2, 'cancel', null, null, 'below minimum — carry forward');
  perform set_config('role', me, true);
  b3 := public.create_payout_batch(jsonb_build_array(jsonb_build_object('creator_id', cy, 'amount_minor', 5000,
          'entry_ids', jsonb_build_array('t:roy:y1'))), f1, 'y again');
  if b3 is not null then passed := passed + 1; else failed := failed || ' [cancelled entries re-payable]'; end if;
  begin delete from public.payout_item_entries where batch_id = b1; failed := failed || ' [paid entries released]';
  exception when others then passed := passed + 1; end;

  -- ---------- as creator X ----------
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.creator_bank_accounts (creator_id, account_name, bsb, account_number) values (cx, 'X Pty Ltd', '062-000', '12345678');
  passed := passed + 1;
  update public.creator_bank_accounts set account_number = '87654321' where creator_id = cx;
  passed := passed + 1;
  begin
    insert into public.creator_bank_accounts (creator_id, account_name, bsb, account_number) values (cy, 'Hijack', '062-000', '11111111');
    failed := failed || ' [creator set another creator''s bank details]';
  exception when others then passed := passed + 1; end;
  begin
    insert into public.creator_bank_accounts (creator_id, account_name, bsb, account_number) values (cx, 'Bad', '62000', 'abc');
    failed := failed || ' [invalid BSB/account accepted]';
  exception when others then passed := passed + 1; end;
  select count(*) into n from public.creator_statements where month = m1;
  if n = 1 then passed := passed + 1; else failed := failed || ' [creator sees only own statement]'; end if;
  select count(*) into n from public.payout_items;
  if n = 1 then passed := passed + 1; else failed := failed || ' [creator sees only own payouts]'; end if;
  select count(*) into n from public.payout_batches;
  if n = 0 then passed := passed + 1; else failed := failed || ' [creator cannot see batches]'; end if;
  select count(*) into n from public.month_end_runs;
  if n = 0 then passed := passed + 1; else failed := failed || ' [creator cannot see month-end totals]'; end if;
  perform set_config('role', me, true);

  -- ---------- as a parent ----------
  perform set_config('request.jwt.claims', json_build_object('sub', up, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform public.payout_batch_action(b3, 'approve'); failed := failed || ' [parent touched payouts]';
  exception when others then passed := passed + 1; end;
  select count(*) into n from public.creator_statements;
  if n = 0 then passed := passed + 1; else failed := failed || ' [parent sees statements]'; end if;
  select count(*) into n from public.creator_bank_accounts;
  if n = 0 then passed := passed + 1; else failed := failed || ' [parent sees bank details]'; end if;
  select count(*) into n from public.finance_settings;
  if n = 0 then passed := passed + 1; else failed := failed || ' [parent sees finance settings]'; end if;
  begin
    insert into public.ledger_entries (id, creator_id, kind, amount_minor, earning_month, run_id, run_status, contract_ref)
      values ('t-hack', cx, 'royalty', 1, m1, 'r', 'final', 'c');
    failed := failed || ' [parent wrote ledger]';
  exception when others then passed := passed + 1; end;
  perform set_config('role', me, true);

  -- finance can read bank details; changes are audited with the number masked
  perform set_config('request.jwt.claims', json_build_object('sub', f1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.creator_bank_accounts where creator_id = cx;
  if n = 1 then passed := passed + 1; else failed := failed || ' [finance reads bank details]'; end if;
  update public.finance_settings set bank_code = 'ZZZ';                 -- row security: silently 0 rows
  select count(*) into n from public.finance_settings where bank_code = 'ZZZ';
  if n = 0 then passed := passed + 1; else failed := failed || ' [finance (non-admin) changed settings]'; end if;
  perform set_config('role', me, true);
  select count(*) into n from public.audit_log where action = 'Creator bank details CHANGED' and detail ->> 'account' = '****321'
    and detail::text not like '%87654321%';
  if n = 1 then passed := passed + 1; else failed := failed || ' [bank change audited, number masked]'; end if;

  if failed <> '' then
    raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed;
  end if;
  raise exception 'ROLLBACK OK — ALL % FINANCE CHECKS PASSED', passed;
end
$fn$;
revoke all on function tests.run_finance_checks() from public, anon, authenticated;
