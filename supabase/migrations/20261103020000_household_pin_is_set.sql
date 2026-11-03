-- Lets the signed-in parent's app know whether a parent PIN has been set,
-- without exposing the PIN hash (household_pins stays unreadable to clients).
create or replace function public.household_pin_is_set()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_pins p where p.household_id = private.my_household_id()
  );
$$;
revoke execute on function public.household_pin_is_set() from public, anon;
grant execute on function public.household_pin_is_set() to authenticated;
