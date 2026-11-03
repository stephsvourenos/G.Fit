-- Lets a signed-in parent close their account completely: removes their login
-- and (by cascade) their household, profiles, PIN and all activity.
-- Refuses for staff and creator logins so those are handled by an admin.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.staff_members where user_id = uid)
     or exists (select 1 from public.creator_users where user_id = uid) then
    raise exception 'Staff and creator accounts are closed by an administrator' using errcode = 'insufficient_privilege';
  end if;
  insert into public.audit_log (actor_user_id, area, action, detail)
    values (null, 'accounts', 'account closed by owner', jsonb_build_object('closed_at', now()));
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
