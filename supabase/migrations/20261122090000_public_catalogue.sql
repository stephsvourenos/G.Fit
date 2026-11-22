-- Public website catalogue (22 Nov 2026).
-- Visitors who aren't signed in (and search engines) can read the titles and descriptions of PUBLISHED workouts
-- and the profiles of ADULT instructors, so the website has real, crawlable workout and instructor pages.
-- Never exposed: drafts, video/playback ids, rights checklists, creator/payee details, anything about members,
-- and junior (under-18) coaches' names or pages.

-- 1. Stable web addresses for instructors (e.g. /instructors/coach-ava).
alter table public.instructors add column if not exists slug text;

create or replace function public.slugify(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]+', '-', 'g')))
$$;

-- A slug is set once from the display name and then kept, so a renamed coach keeps the same address.
create or replace function public.instructors_set_slug() returns trigger
language plpgsql set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if coalesce(new.slug, '') <> '' then new.slug := public.slugify(new.slug); end if;
  if coalesce(new.slug, '') <> '' then return new; end if;
  base := coalesce(nullif(public.slugify(new.display_name), ''), 'instructor');
  candidate := base;
  while exists (select 1 from public.instructors i where i.slug = candidate and i.id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;

drop trigger if exists instructors_set_slug on public.instructors;
create trigger instructors_set_slug before insert or update of slug on public.instructors
  for each row execute function public.instructors_set_slug();

update public.instructors set slug = null where slug is null;
alter table public.instructors alter column slug set not null;
create unique index if not exists instructors_slug_key on public.instructors (slug);

-- 2. Read-only public views. They run as their owner (so they can see published rows without a login) and list
--    columns explicitly, so a column added to the tables later is never exposed by accident.
drop view if exists public.public_workouts;
create view public.public_workouts with (security_barrier = true) as
select
  w.slug,
  w.title,
  w.description,
  w.category,
  w.duration_sec,
  w.intensity,
  w.equipment,
  w.age_bands,
  w.captions,
  w.accessibility_notes,
  w.published_at,
  w.thumbnail,
  case when i.is_minor then null else i.slug end as instructor_slug,
  case when i.is_minor then null else i.display_name end as instructor_name
from public.workouts w
join public.instructors i on i.id = w.instructor_id
where w.state = 'published' and 'AU' = any (w.territories);

drop view if exists public.public_instructors;
create view public.public_instructors with (security_barrier = true) as
select
  i.slug,
  i.display_name,
  i.bio,
  i.specialties,
  i.accent,
  case when i.portrait_consent_at is not null then i.portrait_path end as portrait_path,
  (select count(*) from public.workouts w
    where w.instructor_id = i.id and w.state = 'published' and 'AU' = any (w.territories))::int as workout_count
from public.instructors i
where not i.is_minor
  and exists (select 1 from public.workouts w
    where w.instructor_id = i.id and w.state = 'published' and 'AU' = any (w.territories));

revoke all on public.public_workouts, public.public_instructors from public;
grant select on public.public_workouts, public.public_instructors to anon, authenticated;

comment on view public.public_workouts is
  'Public website: published AU workouts, metadata only. Junior coaches are never named.';
comment on view public.public_instructors is
  'Public website: adult instructors with at least one published workout. Portrait only with recorded consent.';

-- 3. Test suite: select tests.run_public_catalogue_checks();
create or replace function tests.run_public_catalogue_checks()
returns void language plpgsql set search_path = '' as $fn$
declare
  me text := current_user;
  cid uuid; ins_adult uuid; ins_minor uuid; ins_idle uuid; n int; s text; passed int := 0; failed text := '';
begin
  insert into public.creators (display_name, legal_name) values ('Public Test Co', 'Public Test Co Pty Ltd') returning id into cid;
  insert into public.instructors (creator_id, display_name) values (cid, 'Pub Test Adult') returning id into ins_adult;
  insert into public.instructors (creator_id, display_name, is_minor) values (cid, 'Pub Test Junior', true) returning id into ins_minor;
  insert into public.instructors (creator_id, display_name) values (cid, 'Pub Test Idle') returning id into ins_idle;
  insert into public.workouts (slug, title, instructor_id, creator_id, category, duration_sec, intensity, age_bands, state,
    rights_creator_licence_signed, rights_music_cleared, rights_safety_reviewed, rights_guardian_consent, mux_playback_id, captions)
    values ('pubt-live', 'Live', ins_adult, cid, 'dance', 300, 'gentle', '{adult}', 'published', true, true, true, null, 'SECRETPLAYBACK', true),
           ('pubt-junior', 'Junior live', ins_minor, cid, 'dance', 300, 'gentle', '{6-8}', 'published', true, true, true, true, 'SECRETPLAYBACK2', true),
           ('pubt-draft', 'Draft', ins_adult, cid, 'dance', 300, 'gentle', '{adult}', 'draft', false, false, false, null, null, false),
           ('pubt-idle-draft', 'Idle draft', ins_idle, cid, 'dance', 300, 'gentle', '{adult}', 'draft', false, false, false, null, null, false);

  -- Slugs
  select slug into s from public.instructors where id = ins_adult;
  if s = 'pub-test-adult' then passed := passed + 1; else failed := failed || ' [slug from name]'; end if;
  insert into public.instructors (creator_id, display_name) values (cid, 'Pub Test Adult');
  select count(*) into n from public.instructors where slug = 'pub-test-adult-2';
  if n = 1 then passed := passed + 1; else failed := failed || ' [duplicate name gets -2]'; end if;
  update public.instructors set display_name = 'Pub Test Renamed' where id = ins_adult;
  select slug into s from public.instructors where id = ins_adult;
  if s = 'pub-test-adult' then passed := passed + 1; else failed := failed || ' [rename keeps address]'; end if;

  -- As an anonymous visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.public_workouts where slug = 'pubt-live';
  if n = 1 then passed := passed + 1; else failed := failed || ' [published workout visible]'; end if;
  select count(*) into n from public.public_workouts where slug in ('pubt-draft', 'pubt-idle-draft');
  if n = 0 then passed := passed + 1; else failed := failed || ' [drafts hidden]'; end if;
  select count(*) into n from public.public_workouts where slug = 'pubt-junior' and instructor_name is null and instructor_slug is null;
  if n = 1 then passed := passed + 1; else failed := failed || ' [junior coach never named]'; end if;
  select count(*) into n from public.public_instructors where slug like 'pub-test-%';
  if n = 1 then passed := passed + 1; else failed := failed || ' [only the adult coach with published work is listed]'; end if;
  select count(*) into n from public.public_instructors where slug = 'pub-test-adult' and workout_count = 1;
  if n = 1 then passed := passed + 1; else failed := failed || ' [workout count]'; end if;
  select count(*) into n from public.public_workouts w where w::text like '%SECRETPLAYBACK%';
  if n = 0 then passed := passed + 1; else failed := failed || ' [no playback ids]'; end if;
  -- Supabase may grant anon SELECT on tables; row security must still return nothing.
  begin select count(*) into n from public.workouts;
    if n = 0 then passed := passed + 1; else failed := failed || ' [anon reads no workout rows]'; end if;
  exception when insufficient_privilege then passed := passed + 1; end;
  begin select count(*) into n from public.instructors;
    if n = 0 then passed := passed + 1; else failed := failed || ' [anon reads no instructor rows]'; end if;
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('role', me, true);

  if failed <> '' then raise exception 'ROLLBACK — % passed, FAILED:%', passed, failed; end if;
  raise exception 'ROLLBACK OK — ALL % PUBLIC-CATALOGUE CHECKS PASSED', passed;
end $fn$;
revoke all on function tests.run_public_catalogue_checks() from public, anon, authenticated;
