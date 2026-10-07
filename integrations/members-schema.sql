-- =====================================================================
-- Business Beyond Borders: members area
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again later; it skips anything that already exists.
-- =====================================================================

-- ---------- 1. Who is who ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  full_name    text,
  country      text,
  linkedin_url text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- 2. What someone bought (this is where 1-year access lives) ----------
-- product: 'community' for the membership, 'course-<name>' for a course.
-- tier: 'mastermind' or 'beyond'.
-- expires_at: NULL = runs until cancelled; a date = access ends that day.
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product    text not null default 'community',
  tier       text not null default 'mastermind',
  status     text not null default 'active',
  starts_at  timestamptz not null default now(),
  expires_at timestamptz,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- ---------- 3. Things to give access to ----------
create table if not exists public.products (
  key      text primary key,
  name     text not null,
  kind     text not null default 'course',   -- 'community' | 'course'
  position int not null default 0
);
insert into public.products (key, name, kind, position)
values ('community', 'Membership library', 'community', 0)
on conflict (key) do nothing;

-- ---------- 4. The materials themselves ----------
-- kind: 'video' (YouTube/Vimeo link), 'file' (uploaded, private), 'link'.
create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  kind         text not null default 'link',
  url          text,
  storage_path text,
  product      text not null default 'community' references public.products(key) on update cascade,
  min_tier     text not null default 'mastermind',
  published    boolean not null default true,
  -- false (the normal case): members read it inside the website only, never as a file.
  allow_download boolean not null default false,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists materials_product_idx on public.materials (product, position);

-- For projects created before this column existed:
alter table public.materials add column if not exists allow_download boolean not null default false;

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.tier_rank(t text)
returns int language sql immutable as $fn$
  select case lower(coalesce(t, 'mastermind')) when 'beyond' then 2 else 1 end;
$fn$;

-- Is the person logged in right now the owner (admin)?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$fn$;

-- Does the logged-in person have live access to this product at this tier?
create or replace function public.has_access(p_product text, p_min_tier text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.product = p_product
      and m.status = 'active'
      and m.starts_at <= now()
      and (m.expires_at is null or m.expires_at > now())
      and public.tier_rank(m.tier) >= public.tier_rank(p_min_tier)
  );
$fn$;

-- Any live access at all (used for the private file bucket).
create or replace function public.has_any_access()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.starts_at <= now()
      and (m.expires_at is null or m.expires_at > now())
  );
$fn$;

-- A new sign-up automatically gets a profile row. No access is granted here:
-- you give access in the admin page after payment.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email, full_name, country)
  values (new.id, new.email,
          nullif(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'country', ''))
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stops a member from making themselves an admin by editing their own profile.
create or replace function public.protect_profile_flags()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.email := old.email;
  end if;
  return new;
end $fn$;

drop trigger if exists protect_profile_flags on public.profiles;
create trigger protect_profile_flags
  before update on public.profiles
  for each row execute function public.protect_profile_flags();

-- =====================================================================
-- Row level security: nobody sees anything they did not pay for
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;
alter table public.products    enable row level security;
alter table public.materials   enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "memberships read"  on public.memberships;
drop policy if exists "memberships admin" on public.memberships;
create policy "memberships read" on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "memberships admin" on public.memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products read"  on public.products;
drop policy if exists "products admin" on public.products;
create policy "products read" on public.products
  for select to authenticated using (true);
create policy "products admin" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "materials read"  on public.materials;
drop policy if exists "materials admin" on public.materials;
create policy "materials read" on public.materials
  for select to authenticated
  using ((published and public.has_access(product, min_tier)) or public.is_admin());
create policy "materials admin" on public.materials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Private file storage (PDFs, slides, recordings you upload yourself)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('member-files', 'member-files', false)
on conflict (id) do nothing;

drop policy if exists "member files read"  on storage.objects;
drop policy if exists "member files admin" on storage.objects;
create policy "member files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'member-files' and (public.has_any_access() or public.is_admin()));
create policy "member files admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'member-files' and public.is_admin())
  with check (bucket_id = 'member-files' and public.is_admin());

-- =====================================================================
-- LAST STEP: make yourself the admin.
-- Sign up on the website first with your own email, then run this line
-- (replace the address if you use a different one):
--
--   update public.profiles set is_admin = true
--   where email = 'ms.sargsyanmariam@gmail.com';
-- =====================================================================

-- =====================================================================
-- 5. The network: directory, introductions and the LinkedIn pod
--
-- The directory deliberately holds NO email address, phone number or
-- LinkedIn link. Members see who is in the room; only you can connect them.
-- =====================================================================

create table if not exists public.directory_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  country      text,
  city         text,
  industry     text,
  headline     text,          -- what they do, one line
  looking_for  text,          -- clients, partners, suppliers, investors, talent
  can_offer    text,
  listed       boolean not null default false,   -- nothing is shown until they say so
  updated_at   timestamptz not null default now()
);

create table if not exists public.intro_requests (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references auth.users(id) on delete cascade,
  target     uuid not null references auth.users(id) on delete cascade,
  reason     text,
  status     text not null default 'new',    -- new | introduced | declined
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  constraint intro_not_self check (requester <> target)
);
create index if not exists intro_requests_requester_idx on public.intro_requests (requester, created_at desc);

create table if not exists public.pod_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  url          text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists pod_posts_created_idx on public.pod_posts (created_at desc);

-- How many introductions one member may ask for in 30 days. Change the 3.
create or replace function public.intro_quota_ok()
returns boolean language sql stable security definer set search_path = public as $fn$
  select (
    select count(*) from public.intro_requests r
    where r.requester = auth.uid() and r.created_at > now() - interval '30 days'
  ) < 3;
$fn$;

-- One post in the pod per member per day, so nobody floods it.
create or replace function public.pod_quota_ok()
returns boolean language sql stable security definer set search_path = public as $fn$
  select not exists (
    select 1 from public.pod_posts p
    where p.user_id = auth.uid() and p.created_at > now() - interval '20 hours'
  );
$fn$;

alter table public.directory_profiles enable row level security;
alter table public.intro_requests     enable row level security;
alter table public.pod_posts          enable row level security;

-- The directory is a Beyond Mastermind benefit.
drop policy if exists "directory read"  on public.directory_profiles;
drop policy if exists "directory write" on public.directory_profiles;
create policy "directory read" on public.directory_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or (listed and public.has_access('community', 'beyond')));
create policy "directory write" on public.directory_profiles
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check ((user_id = auth.uid() and public.has_any_access()) or public.is_admin());

-- A member sees only their own requests. The person asked about never sees them.
drop policy if exists "intro read"   on public.intro_requests;
drop policy if exists "intro insert" on public.intro_requests;
drop policy if exists "intro admin"  on public.intro_requests;
create policy "intro read" on public.intro_requests
  for select to authenticated using (requester = auth.uid() or public.is_admin());
create policy "intro insert" on public.intro_requests
  for insert to authenticated
  with check (requester = auth.uid()
              and public.has_access('community', 'beyond')
              and public.intro_quota_ok());
create policy "intro admin" on public.intro_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- The pod is a Beyond Mastermind benefit: a post link shows who someone is,
-- so it belongs with the directory, not in the lower plan.
drop policy if exists "pod read"   on public.pod_posts;
drop policy if exists "pod insert" on public.pod_posts;
drop policy if exists "pod delete" on public.pod_posts;
create policy "pod read" on public.pod_posts
  for select to authenticated
  using ((public.has_access('community', 'beyond') and created_at > now() - interval '48 hours')
         or public.is_admin());
create policy "pod insert" on public.pod_posts
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_access('community', 'beyond') and public.pod_quota_ok());
create policy "pod delete" on public.pod_posts
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- 6. Ask Mariam, and the weekly LinkedIn profile check
--
-- Both are between one member and you. No member ever sees another member
-- here, so they belong to every plan.
-- =====================================================================

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question    text not null,
  answer      text,
  status      text not null default 'new',    -- new | answered
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists questions_user_idx on public.questions (user_id, created_at desc);

create table if not exists public.profile_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  linkedin_url text not null,
  goal         text,
  answer       text,
  status       text not null default 'new',   -- new | done
  week_start   date not null default (date_trunc('week', now() at time zone 'utc'))::date,
  created_at   timestamptz not null default now(),
  handled_at   timestamptz
);
create index if not exists profile_reviews_week_idx on public.profile_reviews (week_start);

-- Two questions per member per week keeps the inbox sane.
create or replace function public.question_quota_ok()
returns boolean language sql stable security definer set search_path = public as $fn$
  select (
    select count(*) from public.questions q
    where q.user_id = auth.uid() and q.created_at > now() - interval '7 days'
  ) < 2;
$fn$;

-- THREE profile checks a week in total, for everybody. Change the 3 here.
create or replace function public.review_slots_left()
returns int language sql stable security definer set search_path = public as $fn$
  select greatest(0, 3 - (
    select count(*)::int from public.profile_reviews r
    where r.week_start = (date_trunc('week', now() at time zone 'utc'))::date
  ));
$fn$;

-- A slot must be free, and the same person may come back after 90 days.
create or replace function public.review_quota_ok()
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.review_slots_left() > 0
     and not exists (
       select 1 from public.profile_reviews r
       where r.user_id = auth.uid() and r.created_at > now() - interval '90 days'
     );
$fn$;

alter table public.questions        enable row level security;
alter table public.profile_reviews  enable row level security;

drop policy if exists "questions read"   on public.questions;
drop policy if exists "questions insert" on public.questions;
drop policy if exists "questions admin"  on public.questions;
create policy "questions read" on public.questions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "questions insert" on public.questions
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_any_access() and public.question_quota_ok());
create policy "questions admin" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviews read"   on public.profile_reviews;
drop policy if exists "reviews insert" on public.profile_reviews;
drop policy if exists "reviews admin"  on public.profile_reviews;
create policy "reviews read" on public.profile_reviews
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "reviews insert" on public.profile_reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_any_access() and public.review_quota_ok());
create policy "reviews admin" on public.profile_reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
