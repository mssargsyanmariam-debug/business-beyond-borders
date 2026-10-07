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
