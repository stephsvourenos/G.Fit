-- Every change to a workout's status or rights checklist is written to the
-- audit log automatically, with who did it. The audit log can't be edited.
alter table public.audit_log add column if not exists actor_label text;

create or replace function private.audit_workout_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changes jsonb := '{}';
  who text := coalesce((select auth.jwt()) ->> 'email', 'system');
begin
  if new.state is distinct from old.state then
    changes := changes || jsonb_build_object('state', jsonb_build_array(old.state, new.state));
  end if;
  if new.rights_creator_licence_signed is distinct from old.rights_creator_licence_signed then
    changes := changes || jsonb_build_object('licence_signed', new.rights_creator_licence_signed);
  end if;
  if new.rights_music_cleared is distinct from old.rights_music_cleared then
    changes := changes || jsonb_build_object('music_cleared', new.rights_music_cleared);
  end if;
  if new.rights_safety_reviewed is distinct from old.rights_safety_reviewed then
    changes := changes || jsonb_build_object('safety_reviewed', new.rights_safety_reviewed);
  end if;
  if new.rights_guardian_consent is distinct from old.rights_guardian_consent then
    changes := changes || jsonb_build_object('guardian_consent', new.rights_guardian_consent);
  end if;
  if changes <> '{}' then
    insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
    values ((select auth.uid()), who, 'content',
            case when changes ? 'state' then format('%s: %s → %s', new.title, old.state, new.state)
                 else format('%s: rights checklist updated', new.title) end,
            jsonb_build_object('workout_id', new.id, 'slug', new.slug) || changes);
  end if;
  return new;
end;
$$;
revoke execute on function private.audit_workout_change() from public, anon, authenticated;

drop trigger if exists workouts_audit on public.workouts;
create trigger workouts_audit after update on public.workouts
  for each row execute function private.audit_workout_change();
