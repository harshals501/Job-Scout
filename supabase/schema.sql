-- Job Scout schema. Run once in the Supabase SQL editor.
-- The daily routine writes with the service role key, which bypasses row-level security.
-- Dashboard users only ever see and edit their own rows.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text,
  full_name text,
  headline text,
  resume_text text not null default '',
  positioning_md text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  approved boolean not null default false, -- set by the owner; gates daily runs
  paused boolean not null default false,   -- set by the user
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  source text,
  company text,
  title text,
  location text,
  remote_scope text,
  employment_type text,
  salary text,
  posted_at date,
  description text,
  first_seen_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  run_date date not null,
  verdict text not null check (verdict in ('shortlist', 'pass', 'skip')),
  gate_failed text,
  score numeric(2, 1),
  grade text,
  dimensions jsonb,
  summary text,
  flags jsonb not null default '[]'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'saved', 'contacted', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, job_id)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  company_brief text,
  hook text,
  hook_source text,
  contact_hint text,
  outreach_subject text,
  outreach_body text,
  cover_note text,
  resume_tweaks jsonb not null default '[]'::jsonb,
  screening_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  run_date date not null,
  scanned int not null default 0,
  scored int not null default 0,
  shortlisted int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (profile_id, run_date)
);

create index if not exists matches_profile_run_idx on public.matches (profile_id, run_date desc, score desc);

-- ---------- Triggers ----------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();

-- Create an empty, unapproved profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row-level security ----------

create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where user_id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.matches enable row level security;
alter table public.drafts enable row level security;
alter table public.runs enable row level security;

-- Start from nothing, then grant only what the dashboard needs.
revoke all on public.profiles, public.jobs, public.matches, public.drafts, public.runs from anon, authenticated;

grant select on public.profiles, public.jobs, public.matches, public.drafts, public.runs to authenticated;
grant update (full_name, headline, resume_text, positioning_md, preferences, paused) on public.profiles to authenticated;
grant update (status) on public.matches to authenticated;
grant update (outreach_subject, outreach_body, cover_note) on public.drafts to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists matches_select_own on public.matches;
create policy matches_select_own on public.matches for select to authenticated
  using (profile_id = public.my_profile_id());

drop policy if exists matches_update_own on public.matches;
create policy matches_update_own on public.matches for update to authenticated
  using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

drop policy if exists jobs_select_matched on public.jobs;
create policy jobs_select_matched on public.jobs for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.job_id = jobs.id and m.profile_id = public.my_profile_id()
  ));

drop policy if exists drafts_select_own on public.drafts;
create policy drafts_select_own on public.drafts for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = drafts.match_id and m.profile_id = public.my_profile_id()
  ));

drop policy if exists drafts_update_own on public.drafts;
create policy drafts_update_own on public.drafts for update to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = drafts.match_id and m.profile_id = public.my_profile_id()
  ))
  with check (exists (
    select 1 from public.matches m
    where m.id = drafts.match_id and m.profile_id = public.my_profile_id()
  ));

drop policy if exists runs_select_own on public.runs;
create policy runs_select_own on public.runs for select to authenticated
  using (profile_id = public.my_profile_id());
