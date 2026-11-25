-- Creator Acquisition CRM — Phase 1 (25 Nov 2026)
--
-- Prospects are fitness creators G.Fit would like to recruit. They are NOT users: no login is created for them.
-- Everything here is staff-only (admins and the new Recruiter role). Creators and families can read none of it.
--
-- Rules the database enforces (not just the screens):
--   * Unknown stays unknown: every researched field is nullable; nothing defaults to 0 or false.
--   * A later research file never overwrites the stage, notes, outreach history, assignment or do-not-contact.
--   * Stages that mean a real event happened (application submitted, agreement accepted, content approved,
--     launch ready, ...) can't be reached by dragging a card. Only the system can set them, or an admin with a
--     written reason (audited).
--   * Do-not-contact is permanent until an admin clears it with a reason. It is kept as a one-way fingerprint in a
--     suppression list, so it still applies if the prospect is deleted and later re-imported.
--   * Outreach is logged only when a person confirms they sent it. Opening a profile or copying a draft logs nothing.
--   * Commercial email needs the address to be confirmed as published for business enquiries (or express consent).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------
-- Settings (one row) and pipeline stages
-- ---------------------------------------------------------------------------------------------------------------
create table public.crm_settings (
  id int primary key default 1 check (id = 1),
  targets jsonb not null default '{
    "launch_date": "2026-12-20", "founding_creators": 150, "qualified_prospects": 3000, "signed_creators": 240,
    "min_approved_workouts": 5, "workout_library": 750, "waitlist_registrations": 15000,
    "monthly_new_subscribers": 5294, "monthly_churn_pct": 15}',
  queue jsonb not null default '{
    "new_per_day": 50, "follow_ups_per_day": 30, "first_follow_up_days": 4, "second_follow_up_days": 7,
    "max_follow_ups": 2, "duplicate_guard_days": 3}',
  scoring jsonb not null default '{
    "weights": {"existing_content_score": 25, "audience_engagement_score": 20, "monetisation_score": 20,
                "promotion_potential_score": 20, "qualification_quality_score": 10, "catalogue_gap_score": 5},
    "tiers": [{"tier": "A", "min": 85}, {"tier": "B", "min": 75}, {"tier": "C", "min": 60}, {"tier": "D", "min": 0}]}',
  categories jsonb not null default '[
    {"name": "Pilates and barre", "target": 25}, {"name": "Strength and personal training", "target": 25},
    {"name": "Dance fitness", "target": 20}, {"name": "Yoga and mobility", "target": 20},
    {"name": "HIIT and cardio", "target": 15}, {"name": "Kids and family fitness", "target": 15},
    {"name": "Low-impact and over-50s fitness", "target": 10}, {"name": "Prenatal and postnatal fitness", "target": 10},
    {"name": "Sport-specific conditioning", "target": 10}]',
  founder_name text check (length(founder_name) <= 200),
  application_url text check (application_url ~* '^https://'),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint targets_shape check (jsonb_typeof(targets) = 'object' and jsonb_typeof(queue) = 'object'
    and jsonb_typeof(scoring -> 'weights') = 'object' and jsonb_typeof(scoring -> 'tiers') = 'array' and jsonb_typeof(categories) = 'array')
);
insert into public.crm_settings (id) values (1);

create table public.crm_stages (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (btrim(label) <> '' and length(label) <= 60),
  position int not null,
  kind text not null check (kind in ('stage', 'outcome')),
  -- true = reaching this stage means a real platform event happened; it can't be set by hand without an admin override
  system_event boolean not null default false,
  -- 'new' = in the daily queue of creators to contact; 'follow_up' = waiting for a follow-up
  queue text check (queue in ('new', 'follow_up')),
  active boolean not null default true,
  built_in boolean not null default false
);
insert into public.crm_stages (key, label, position, kind, system_event, queue, built_in) values
  ('identified', 'Identified', 1, 'stage', false, 'new', true),
  ('qualified', 'Qualified', 2, 'stage', false, 'new', true),
  ('ready_for_outreach', 'Ready for Outreach', 3, 'stage', false, 'new', true),
  ('contacted', 'Contacted', 4, 'stage', false, 'follow_up', true),
  ('follow_up_required', 'Follow-Up Required', 5, 'stage', false, 'follow_up', true),
  ('responded', 'Responded', 6, 'stage', false, null, true),
  ('interested', 'Interested', 7, 'stage', false, null, true),
  ('application_invited', 'Application Invited', 8, 'stage', false, null, true),
  ('application_submitted', 'Application Submitted', 9, 'stage', true, null, true),
  ('under_review', 'Under Review', 10, 'stage', true, null, true),
  ('approved', 'Approved', 11, 'stage', true, null, true),
  ('agreement_pending', 'Agreement Pending', 12, 'stage', true, null, true),
  ('agreement_accepted', 'Agreement Accepted', 13, 'stage', true, null, true),
  ('onboarding', 'Onboarding', 14, 'stage', true, null, true),
  ('awaiting_content', 'Awaiting Content', 15, 'stage', true, null, true),
  ('content_under_review', 'Content Under Review', 16, 'stage', true, null, true),
  ('launch_ready', 'Launch Ready', 17, 'stage', true, null, true),
  ('active_creator', 'Active Creator', 18, 'stage', true, null, true),
  ('not_interested', 'Not Interested', 101, 'outcome', false, null, true),
  ('not_suitable', 'Not Suitable', 102, 'outcome', false, null, true),
  ('no_response', 'No Response', 103, 'outcome', false, null, true),
  ('revisit_later', 'Revisit Later', 104, 'outcome', false, null, true),
  ('declined', 'Declined', 105, 'outcome', false, null, true),
  ('do_not_contact', 'Do Not Contact', 106, 'outcome', false, null, true);

-- Built-in stages keep their meaning: admins may rename, reorder or hide them, not change what they represent.
create or replace function private.crm_stage_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.built_in then raise exception 'Built-in stages can be hidden but not deleted'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.system_event or new.built_in then raise exception 'New stages are ordinary manual stages'; end if;
    return new;
  end if;
  if old.built_in and (new.key <> old.key or new.kind <> old.kind or new.system_event <> old.system_event
                       or new.queue is distinct from old.queue or not new.built_in) then
    raise exception 'Built-in stages can be renamed, reordered or hidden, but their meaning can''t change';
  end if;
  if old.key = 'do_not_contact' and not new.active then raise exception 'Do Not Contact can''t be hidden'; end if;
  return new;
end $$;
create trigger crm_stage_guard before insert or update or delete on public.crm_stages
  for each row execute function private.crm_stage_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- Import batches, prospects, history, tasks, suppression list
-- ---------------------------------------------------------------------------------------------------------------
create table public.crm_import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'prospects' check (kind in ('prospects', 'partners')),
  file_name text not null check (length(file_name) <= 300),
  sheet_name text check (length(sheet_name) <= 200),
  options jsonb not null default '{}',
  status text not null default 'in_progress' check (status in ('in_progress', 'complete', 'abandoned')),
  stats jsonb not null default '{}',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.crm_prospects (
  id uuid primary key default gen_random_uuid(),
  ref bigint generated always as identity unique,
  creator_name text not null check (btrim(creator_name) <> '' and length(creator_name) <= 1000),
  business_name text check (length(business_name) <= 1000),
  country text check (length(country) <= 1000),
  city text check (length(city) <= 1000),
  primary_language text check (length(primary_language) <= 1000),
  primary_category text check (length(primary_category) <= 1000),
  secondary_categories text[],
  creator_type text check (length(creator_type) <= 1000),
  instagram_url text check (instagram_url ~* '^https?://'),
  instagram_followers bigint check (instagram_followers >= 0),
  tiktok_url text check (tiktok_url ~* '^https?://'),
  tiktok_followers bigint check (tiktok_followers >= 0),
  youtube_url text check (youtube_url ~* '^https?://'),
  youtube_subscribers bigint check (youtube_subscribers >= 0),
  facebook_url text check (facebook_url ~* '^https?://'),
  facebook_followers bigint check (facebook_followers >= 0),
  linkedin_url text check (linkedin_url ~* '^https?://'),
  website_url text check (website_url ~* '^https?://'),
  primary_platform text check (primary_platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'email', 'contact_form', 'phone', 'website')),
  estimated_combined_followers bigint check (estimated_combined_followers >= 0),
  engagement_observations text check (length(engagement_observations) <= 5000),
  last_active_date date,
  full_length_workouts_available boolean,
  estimated_workout_video_count bigint check (estimated_workout_video_count >= 0),
  example_workout_url text check (example_workout_url ~* '^https?://'),
  existing_paid_products text check (length(existing_paid_products) <= 5000),
  existing_membership boolean,
  monetisation_platform text check (length(monetisation_platform) <= 1000),
  current_programme_price numeric check (current_programme_price >= 0),
  current_programme_currency text check (length(current_programme_currency) <= 1000),
  current_programme_billing_frequency text check (length(current_programme_billing_frequency) <= 1000),
  existing_fitness_app text check (length(existing_fitness_app) <= 1000),
  qualifications_visible boolean,
  qualifications_details text check (length(qualifications_details) <= 5000),
  content_rights_risk text check (content_rights_risk in ('low', 'medium', 'high')),
  music_licensing_risk text check (music_licensing_risk in ('low', 'medium', 'high')),
  audience_demographic text check (length(audience_demographic) <= 5000),
  public_business_email text,
  public_business_phone text check (length(public_business_phone) <= 1000),
  contact_form_url text check (contact_form_url ~* '^https?://'),
  preferred_outreach_channel text check (preferred_outreach_channel in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'email', 'contact_form', 'phone', 'website')),
  contact_source_url text check (contact_source_url ~* '^https?://'),
  outreach_permission_notes text check (length(outreach_permission_notes) <= 5000),
  why_gfit_is_relevant text check (length(why_gfit_is_relevant) <= 5000),
  specific_personalisation_detail text check (length(specific_personalisation_detail) <= 5000),
  recommended_pitch_angle text check (length(recommended_pitch_angle) <= 5000),
  potential_objections text check (length(potential_objections) <= 5000),
  estimated_recruitment_difficulty text check (estimated_recruitment_difficulty in ('low', 'medium', 'high')),
  existing_content_score numeric check (existing_content_score >= 0 and existing_content_score <= 25),
  audience_engagement_score numeric check (audience_engagement_score >= 0 and audience_engagement_score <= 20),
  monetisation_score numeric check (monetisation_score >= 0 and monetisation_score <= 20),
  promotion_potential_score numeric check (promotion_potential_score >= 0 and promotion_potential_score <= 20),
  qualification_quality_score numeric check (qualification_quality_score >= 0 and qualification_quality_score <= 10),
  catalogue_gap_score numeric check (catalogue_gap_score >= 0 and catalogue_gap_score <= 5),
  total_fit_score numeric check (total_fit_score >= 0 and total_fit_score <= 100),
  confidence_level text check (confidence_level in ('high', 'medium', 'low')),
  priority_tier text check (priority_tier in ('a', 'b', 'c', 'd')),
  personalised_initial_dm text check (length(personalised_initial_dm) <= 5000),
  personalised_initial_email text check (length(personalised_initial_email) <= 5000),
  research_source_urls text[],
  research_date date,
  -- derived
  allocation_category text check (length(allocation_category) <= 200),
  key_instagram text, key_tiktok text, key_youtube text, key_email text, key_website text, key_name text,
  fit_score numeric(5,1), fit_tier text, criteria_known int not null default 0,
  confidence_rank smallint generated always as (case confidence_level when 'high' then 3 when 'medium' then 2 when 'low' then 1 end) stored,
  fit_score_manual numeric(5,1) check (fit_score_manual between 0 and 100),
  fit_score_manual_reason text check (length(fit_score_manual_reason) <= 1000),
  -- recruitment management (never changed by a later research file)
  stage text not null default 'identified' references public.crm_stages(key) on update cascade,
  stage_changed_at timestamptz not null default now(),
  recruitment_outcome text check (length(recruitment_outcome) <= 1000),
  reason_lost text check (length(reason_lost) <= 1000),
  assigned_to uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  original_recruitment_source text check (length(original_recruitment_source) <= 200),
  nominated_by_creator_id uuid references public.creators(id) on delete set null,
  converted_creator_id uuid references public.creators(id) on delete set null,
  last_contact_at timestamptz,
  last_outbound_at timestamptz,
  last_inbound_at timestamptz,
  outbound_count int not null default 0,
  snoozed_until date,
  do_not_contact boolean not null default false,
  dnc_reason text check (length(dnc_reason) <= 1000),
  dnc_at timestamptz,
  outreach_permission_status text not null default 'unknown'
    check (outreach_permission_status in ('unknown', 'published_business_contact', 'express_consent', 'withdrawn')),
  contact_verified_on date,
  unavailable_channels text[] not null default '{}',
  -- provenance: field → {"batch": import id or null, "research_date": ..., "at": when, "by": who}
  field_sources jsonb not null default '{}',
  import_batch_id uuid references public.crm_import_batches(id) on delete set null,
  last_import_batch_id uuid references public.crm_import_batches(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dnc_stage check (not do_not_contact or stage in ('do_not_contact', 'declined', 'not_interested', 'not_suitable', 'no_response'))
);
create index crm_prospects_stage_idx on public.crm_prospects (stage);
create index crm_prospects_assigned_idx on public.crm_prospects (assigned_to);
create index crm_prospects_score_idx on public.crm_prospects (fit_score desc nulls last);
create index crm_prospects_category_idx on public.crm_prospects (allocation_category);
create index crm_prospects_country_idx on public.crm_prospects (country);
create index crm_prospects_created_idx on public.crm_prospects (created_at);
create index crm_prospects_batch_idx on public.crm_prospects (import_batch_id);
create index crm_prospects_tags_idx on public.crm_prospects using gin (tags);
create index crm_prospects_name_trgm on public.crm_prospects using gin ((coalesce(creator_name, '') || ' ' || coalesce(business_name, '')) extensions.gin_trgm_ops);
create index crm_prospects_key_ig on public.crm_prospects (key_instagram) where key_instagram is not null;
create index crm_prospects_key_tt on public.crm_prospects (key_tiktok) where key_tiktok is not null;
create index crm_prospects_key_yt on public.crm_prospects (key_youtube) where key_youtube is not null;
create index crm_prospects_key_em on public.crm_prospects (key_email) where key_email is not null;
create index crm_prospects_key_web on public.crm_prospects (key_website) where key_website is not null;
create index crm_prospects_key_name on public.crm_prospects (key_name) where key_name is not null;

-- When each prospect first reached each stage. Funnel numbers come from here, so moving a card back and forth, or
-- logging the same outreach twice, can't inflate conversion rates.
create table public.crm_stage_reached (
  prospect_id uuid not null references public.crm_prospects(id) on delete cascade,
  stage text not null references public.crm_stages(key) on update cascade,
  first_at timestamptz not null default now(),
  primary key (prospect_id, stage)
);
create index crm_stage_reached_stage_idx on public.crm_stage_reached (stage, first_at);

create table public.crm_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and length(name) <= 200),
  channel text not null check (channel in ('dm', 'email', 'contact_form', 'linkedin')),
  purpose text not null check (purpose in ('initial', 'follow_up', 'interested_response', 'application_invitation',
    'agreement_reminder', 'content_reminder', 'nomination_request', 'partnership', 'onboarding', 'other')),
  categories text[] not null default '{}',
  creator_types text[] not null default '{}',
  stage text references public.crm_stages(key) on update cascade,
  objection text check (length(objection) <= 200),
  follow_up_number int check (follow_up_number between 1 and 5),
  partnership_type text check (length(partnership_type) <= 200),
  commercial boolean not null default true,
  active boolean not null default true,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.crm_template_versions (
  template_id uuid not null references public.crm_templates(id) on delete cascade,
  version int not null,
  subject text check (length(subject) <= 300),
  body text not null check (btrim(body) <> '' and length(body) <= 5000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (template_id, version)
);

create table public.crm_activities (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.crm_prospects(id) on delete cascade,
  kind text not null check (kind in ('outreach', 'reply', 'note', 'stage_change', 'task', 'import', 'import_update', 'edit',
                                     'score_adjust', 'dnc', 'permission', 'assignment', 'objection', 'channel')),
  channel text,
  direction text check (direction in ('out', 'in')),
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  template_id uuid references public.crm_templates(id) on delete set null,
  template_version int,
  subject text check (length(subject) <= 300),
  body text check (length(body) <= 10000),
  detail jsonb not null default '{}',
  actor_user_id uuid default auth.uid(),
  actor_label text default coalesce(auth.jwt() ->> 'email', 'system'),
  occurred_at timestamptz not null default now()
);
create index crm_activities_prospect_idx on public.crm_activities (prospect_id, occurred_at desc);
create index crm_activities_kind_idx on public.crm_activities (kind, occurred_at);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.crm_prospects(id) on delete cascade,
  kind text not null check (kind in ('follow_up', 'reply', 'custom')),
  title text not null check (btrim(title) <> '' and length(title) <= 300),
  follow_up_number int,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  snoozed_until date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);
create index crm_tasks_open_idx on public.crm_tasks (due_on) where status = 'open';
create index crm_tasks_prospect_idx on public.crm_tasks (prospect_id);

-- Do-not-contact list: only one-way fingerprints (SHA-256) of the identifiers — no names or addresses are kept.
create table public.crm_suppressions (
  key_hash text primary key,
  key_type text not null check (key_type in ('instagram', 'tiktok', 'youtube', 'email', 'website')),
  reason text check (length(reason) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

alter table public.crm_settings enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_import_batches enable row level security;
alter table public.crm_prospects enable row level security;
alter table public.crm_stage_reached enable row level security;
alter table public.crm_templates enable row level security;
alter table public.crm_template_versions enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_suppressions enable row level security;

-- Staff access: admins and recruiters work in the CRM; only admins change settings/stages, delete prospects or clear DNC.
create policy crm_settings_read on public.crm_settings for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_settings_admin on public.crm_settings for update to authenticated using ((select private.has_staff_role('{admin}'))) with check ((select private.has_staff_role('{admin}')));
create policy crm_stages_read on public.crm_stages for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_stages_admin on public.crm_stages for all to authenticated using ((select private.has_staff_role('{admin}'))) with check ((select private.has_staff_role('{admin}')));
create policy crm_batches_staff on public.crm_import_batches for all to authenticated using ((select private.has_staff_role('{admin,recruiter}'))) with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_prospects_read on public.crm_prospects for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_prospects_insert on public.crm_prospects for insert to authenticated with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_prospects_update on public.crm_prospects for update to authenticated using ((select private.has_staff_role('{admin,recruiter}'))) with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_prospects_delete on public.crm_prospects for delete to authenticated using ((select private.has_staff_role('{admin}')));
create policy crm_reached_read on public.crm_stage_reached for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_templates_staff on public.crm_templates for all to authenticated using ((select private.has_staff_role('{admin,recruiter}'))) with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_tv_read on public.crm_template_versions for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_tv_insert on public.crm_template_versions for insert to authenticated with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_activities_read on public.crm_activities for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_activities_insert on public.crm_activities for insert to authenticated
  with check ((select private.has_staff_role('{admin,recruiter}')) and actor_user_id = (select auth.uid()));
create policy crm_tasks_staff on public.crm_tasks for all to authenticated using ((select private.has_staff_role('{admin,recruiter}'))) with check ((select private.has_staff_role('{admin,recruiter}')));
create policy crm_suppressions_read on public.crm_suppressions for select to authenticated using ((select private.has_staff_role('{admin,recruiter}')));

-- History and template versions are append-only (activities disappear only when their prospect is deleted).
create or replace function private.crm_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and tg_table_name = 'crm_activities'
     and not exists (select 1 from public.crm_prospects p where p.id = old.prospect_id) then
    return old; -- cascade from deleting the prospect (data deletion request)
  end if;
  if tg_op = 'DELETE' and tg_table_name = 'crm_template_versions'
     and not exists (select 1 from public.crm_templates t where t.id = old.template_id) then
    return old;
  end if;
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op using errcode = 'insufficient_privilege';
end $$;
create trigger crm_activities_append_only before update or delete on public.crm_activities
  for each row execute function private.crm_append_only();
create trigger crm_template_versions_append_only before update or delete on public.crm_template_versions
  for each row execute function private.crm_append_only();

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------
create or replace function private.crm_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Australia/Sydney')::date $$;

create or replace function private.crm_hash(t text, v text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(t || ':' || v, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function private.crm_is_suppressed(p public.crm_prospects) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crm_suppressions s where s.key_hash in (
    private.crm_hash('instagram', p.key_instagram), private.crm_hash('tiktok', p.key_tiktok),
    private.crm_hash('youtube', p.key_youtube), private.crm_hash('email', p.key_email)))
$$;

create or replace function private.crm_user_email(u uuid) returns text
language sql stable security definer set search_path = '' as $$ select email::text from auth.users where id = u $$;

create or replace function private.crm_is_staff_user(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.staff_members s where s.user_id = u) $$;

create or replace function private.crm_audit(p_action text, p_detail jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm', left(p_action, 500), p_detail)
$$;

create or replace function private.crm_require_staff() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not private.has_staff_role('{admin,recruiter}') then
    raise exception 'Only admins and recruiters can use the creator CRM' using errcode = 'insufficient_privilege';
  end if;
end $$;

/** Fit score from the six criteria (re-weighted by Settings), else the researched total; a manual score wins. */
create or replace function private.crm_fit_score(p public.crm_prospects, scoring jsonb)
returns table (score numeric, tier text, known int)
language plpgsql stable set search_path = '' as $$
declare
  crit text[] := array['existing_content_score','audience_engagement_score','monetisation_score','promotion_potential_score','qualification_quality_score','catalogue_gap_score'];
  maxes numeric[] := array[25,20,20,20,10,5];
  vals numeric[] := array[p.existing_content_score, p.audience_engagement_score, p.monetisation_score, p.promotion_potential_score, p.qualification_quality_score, p.catalogue_gap_score];
  w numeric; tw numeric := 0; pts numeric := 0; k int := 0; s numeric;
begin
  for i in 1..6 loop
    w := coalesce((scoring -> 'weights' ->> crit[i])::numeric, maxes[i]);
    tw := tw + w;
    if vals[i] is not null then
      k := k + 1;
      pts := pts + least(greatest(vals[i], 0), maxes[i]) / maxes[i] * w;
    end if;
  end loop;
  s := case when p.fit_score_manual is not null then p.fit_score_manual
            when k > 0 then pts / nullif(tw, 0) * 100
            else p.total_fit_score end;
  if s is not null then s := round(least(greatest(s, 0), 100), 1); end if;
  return query select s,
    case when s is null then null else (select t ->> 'tier' from jsonb_array_elements(scoring -> 'tiers') t
                                        where s >= (t ->> 'min')::numeric order by (t ->> 'min')::numeric desc limit 1) end,
    k;
end $$;

-- Researched / contact columns (the only ones a research file can fill or refresh).
create or replace function private.crm_research_columns() returns text[]
language sql immutable set search_path = '' as $$ select '{creator_name,business_name,country,city,primary_language,primary_category,secondary_categories,creator_type,instagram_url,instagram_followers,tiktok_url,tiktok_followers,youtube_url,youtube_subscribers,facebook_url,facebook_followers,linkedin_url,website_url,primary_platform,estimated_combined_followers,engagement_observations,last_active_date,full_length_workouts_available,estimated_workout_video_count,example_workout_url,existing_paid_products,existing_membership,monetisation_platform,current_programme_price,current_programme_currency,current_programme_billing_frequency,existing_fitness_app,qualifications_visible,qualifications_details,content_rights_risk,music_licensing_risk,audience_demographic,public_business_email,public_business_phone,contact_form_url,preferred_outreach_channel,contact_source_url,outreach_permission_notes,why_gfit_is_relevant,specific_personalisation_detail,recommended_pitch_angle,potential_objections,estimated_recruitment_difficulty,existing_content_score,audience_engagement_score,monetisation_score,promotion_potential_score,qualification_quality_score,catalogue_gap_score,total_fit_score,confidence_level,priority_tier,personalised_initial_dm,personalised_initial_email,research_source_urls,research_date}'::text[] $$;

-- ---------------------------------------------------------------------------------------------------------------
-- The prospect rules (one trigger before, one after every change)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function private.crm_prospects_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  st public.crm_stages%rowtype;
  fs record;
  cols text[] := private.crm_research_columns();
  c text;
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}' end;
  n jsonb := to_jsonb(new);
  src jsonb;
  recalc boolean := coalesce(current_setting('gfit.crm_recalc', true), '') = 'on';
  sys boolean := coalesce(current_setting('gfit.crm_system', true), '') = 'on';
  override text := nullif(btrim(coalesce(current_setting('gfit.crm_override_reason', true), '')), '');
begin
  -- score
  select * into fs from private.crm_fit_score(new, (select s.scoring from public.crm_settings s where s.id = 1));
  new.fit_score := fs.score; new.fit_tier := fs.tier; new.criteria_known := fs.known;
  if recalc then return new; end if;

  if tg_op = 'UPDATE' then new.updated_at := now(); new.created_at := old.created_at; new.ref := old.ref; end if;

  -- do-not-contact: re-importing a suppressed creator keeps them suppressed
  if tg_op = 'INSERT' and private.crm_is_suppressed(new) then
    new.do_not_contact := true;
    new.dnc_reason := coalesce(new.dnc_reason, 'On the do-not-contact list');
  end if;
  if new.do_not_contact and (tg_op = 'INSERT' or not old.do_not_contact) then
    new.dnc_at := now();
    if new.stage not in ('do_not_contact', 'declined', 'not_interested', 'not_suitable', 'no_response') then new.stage := 'do_not_contact'; end if;
  end if;
  if tg_op = 'UPDATE' and old.do_not_contact and not new.do_not_contact
     and coalesce(current_setting('gfit.crm_clear_dnc', true), '') <> 'on' then
    raise exception 'Do-not-contact can only be cleared by an admin, with a reason (use “Clear do-not-contact”)';
  end if;

  -- stage rules
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    select * into st from public.crm_stages where key = new.stage;
    if not st.active and not sys then raise exception 'The % stage is hidden in Settings', st.label; end if;
    if st.system_event and not sys then
      if override is null or not private.has_staff_role('{admin}') then
        raise exception '“%” is set automatically when it actually happens. An admin can override it with a reason.', st.label
          using errcode = 'insufficient_privilege';
      end if;
    end if;
    if new.do_not_contact and new.stage not in ('do_not_contact', 'declined', 'not_interested', 'not_suitable', 'no_response') then
      raise exception 'This creator is marked do-not-contact, so their stage can''t move forward';
    end if;
    if new.stage = 'do_not_contact' and not new.do_not_contact then
      new.do_not_contact := true; new.dnc_at := now(); new.dnc_reason := coalesce(new.dnc_reason, 'Moved to Do Not Contact');
    end if;
    new.stage_changed_at := now();
  end if;

  -- provenance for researched fields that were set or changed
  src := jsonb_strip_nulls(jsonb_build_object(
    'batch', nullif(current_setting('gfit.crm_batch', true), ''),
    'research_date', new.research_date,
    'at', now(),
    'by', coalesce((select auth.jwt()) ->> 'email', 'system')));
  foreach c in array cols loop
    if n -> c is not null and n -> c <> 'null'::jsonb and (o -> c) is distinct from (n -> c) then
      new.field_sources := coalesce(new.field_sources, '{}') || jsonb_build_object(c, src);
    end if;
  end loop;
  return new;
end $$;
create trigger crm_prospects_before before insert or update on public.crm_prospects
  for each row execute function private.crm_prospects_before();

create or replace function private.crm_prospects_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed text[];
  override text := nullif(btrim(coalesce(current_setting('gfit.crm_override_reason', true), '')), '');
  sys boolean := coalesce(current_setting('gfit.crm_system', true), '') = 'on';
  st public.crm_stages%rowtype;
begin
  if coalesce(current_setting('gfit.crm_recalc', true), '') = 'on' then return null; end if;

  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.crm_stage_reached (prospect_id, stage) values (new.id, new.stage) on conflict do nothing;
    if tg_op = 'UPDATE' then
      select * into st from public.crm_stages where key = new.stage;
      insert into public.crm_activities (prospect_id, kind, detail)
        values (new.id, 'stage_change', jsonb_strip_nulls(jsonb_build_object('from', old.stage, 'to', new.stage,
          'override_reason', case when st.system_event and not sys then override end)));
      if st.system_event and not sys then
        insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
        values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm',
                format('Stage override: %s → %s (%s)', new.creator_name, st.label, override),
                jsonb_build_object('prospect_id', new.id, 'from', old.stage, 'to', new.stage, 'reason', override));
      end if;
    end if;
  end if;

  if new.do_not_contact and (tg_op = 'INSERT' or not old.do_not_contact) then
    insert into public.crm_suppressions (key_hash, key_type, reason)
    select private.crm_hash(t, v), t, left(new.dnc_reason, 300)
    from (values ('instagram', new.key_instagram), ('tiktok', new.key_tiktok), ('youtube', new.key_youtube), ('email', new.key_email)) k(t, v)
    where v is not null
    on conflict (key_hash) do nothing;
    if tg_op = 'UPDATE' then
      insert into public.crm_activities (prospect_id, kind, body) values (new.id, 'dnc', new.dnc_reason);
      insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
      values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm',
              format('Do-not-contact: %s', new.creator_name), jsonb_build_object('prospect_id', new.id, 'reason', new.dnc_reason));
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(c) into changed from unnest(private.crm_research_columns()) c
      where (to_jsonb(old) -> c) is distinct from (to_jsonb(new) -> c);
    if changed is not null then
      insert into public.crm_activities (prospect_id, kind, detail)
      values (new.id, case when nullif(current_setting('gfit.crm_batch', true), '') is null then 'edit' else 'import_update' end,
              jsonb_strip_nulls(jsonb_build_object('fields', changed, 'batch', nullif(current_setting('gfit.crm_batch', true), ''))));
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.crm_activities (prospect_id, kind, detail)
      values (new.id, 'assignment', jsonb_build_object('to', (select u.email from auth.users u where u.id = new.assigned_to)));
    end if;
  end if;
  return null;
end $$;
create trigger crm_prospects_after after insert or update on public.crm_prospects
  for each row execute function private.crm_prospects_after();

-- Settings changes are audited; a change to the scoring weights or tiers re-scores everyone.
create or replace function private.crm_settings_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm', 'CRM settings changed',
          jsonb_build_object('before', to_jsonb(old) - 'updated_at' - 'updated_by', 'after', to_jsonb(new) - 'updated_at' - 'updated_by'));
  return new;
end $$;
create trigger crm_settings_changed before update on public.crm_settings
  for each row execute function private.crm_settings_changed();

create or replace function private.crm_rescore() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.scoring is distinct from old.scoring then
    perform set_config('gfit.crm_recalc', 'on', true);
    update public.crm_prospects set fit_score_manual = fit_score_manual;
    perform set_config('gfit.crm_recalc', '', true);
  end if;
  return null;
end $$;
create trigger crm_rescore after update on public.crm_settings
  for each row execute function private.crm_rescore();

create or replace function private.crm_stage_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_user_id, actor_label, area, action, detail)
  values ((select auth.uid()), coalesce((select auth.jwt()) ->> 'email', 'system'), 'crm', format('Pipeline stage %s: %s', lower(tg_op), coalesce(new.key, old.key)),
          jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return null;
end $$;
create trigger crm_stage_audit after insert or update or delete on public.crm_stages
  for each row execute function private.crm_stage_audit();

revoke execute on function private.crm_stage_guard(), private.crm_append_only(), private.crm_today(), private.crm_hash(text, text),
  private.crm_is_suppressed(public.crm_prospects), private.crm_user_email(uuid), private.crm_is_staff_user(uuid), private.crm_audit(text, jsonb),
  private.crm_require_staff(), private.crm_fit_score(public.crm_prospects, jsonb), private.crm_research_columns(), private.crm_prospects_before(),
  private.crm_prospects_after(), private.crm_settings_changed(), private.crm_rescore(), private.crm_stage_audit() from public, anon;
grant execute on function private.crm_today() to authenticated;
grant execute on function private.crm_require_staff() to authenticated;
grant execute on function private.crm_fit_score(public.crm_prospects, jsonb) to authenticated;
grant execute on function private.crm_research_columns() to authenticated;
grant execute on function private.crm_audit(text, jsonb), private.crm_hash(text, text), private.crm_user_email(uuid), private.crm_is_staff_user(uuid) to authenticated;

