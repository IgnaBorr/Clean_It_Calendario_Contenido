-- Ribera Content Hub - Roles, permisos por empresa y RLS robusto
-- Ejecutar en Supabase > SQL Editor > New query > Run.
-- Requiere que ya exista el esquema base del Content Hub.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Perfiles de usuario y accesos por empresa
-- ─────────────────────────────────────────────
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'editor' check (role in ('admin_ribera','editor','viewer')),
  can_manage_companies boolean not null default false,
  can_delete boolean not null default false,
  ribera_access boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_company_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, company_id)
);

create index if not exists idx_user_company_access_user_id on public.user_company_access(user_id);
create index if not exists idx_user_company_access_company_id on public.user_company_access(company_id);

-- Updated-at trigger compartido
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_company_access_updated_at on public.user_company_access;
create trigger trg_user_company_access_updated_at
before update on public.user_company_access
for each row execute function public.set_updated_at();

-- Perfil automático para usuarios nuevos de Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    user_id,
    email,
    role,
    can_manage_companies,
    can_delete,
    ribera_access,
    active
  )
  values (
    new.id,
    lower(new.email),
    case when lower(new.email) = 'ribera.audiovisuales@gmail.com' then 'admin_ribera' else 'editor' end,
    case when lower(new.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
    case when lower(new.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
    case when lower(new.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
    true
  )
  on conflict (user_id) do update set
    email = excluded.email,
    role = case when excluded.email = 'ribera.audiovisuales@gmail.com' then 'admin_ribera' else public.user_profiles.role end,
    can_manage_companies = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.can_manage_companies end,
    can_delete = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.can_delete end,
    ribera_access = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.ribera_access end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_content_hub_profile on auth.users;
create trigger on_auth_user_created_content_hub_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Bootstrap de perfiles existentes
insert into public.user_profiles (user_id, email, role, can_manage_companies, can_delete, ribera_access, active)
select
  u.id,
  lower(u.email),
  case when lower(u.email) = 'ribera.audiovisuales@gmail.com' then 'admin_ribera' else 'editor' end,
  case when lower(u.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
  case when lower(u.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
  case when lower(u.email) = 'ribera.audiovisuales@gmail.com' then true else false end,
  true
from auth.users u
where u.email is not null
on conflict (user_id) do update set
  email = excluded.email,
  role = case when excluded.email = 'ribera.audiovisuales@gmail.com' then 'admin_ribera' else public.user_profiles.role end,
  can_manage_companies = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.can_manage_companies end,
  can_delete = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.can_delete end,
  ribera_access = case when excluded.email = 'ribera.audiovisuales@gmail.com' then true else public.user_profiles.ribera_access end,
  updated_at = now();

-- Mantiene continuidad: usuarios existentes no-Ribera reciben acceso editor a empresas no-Ribera.
insert into public.user_company_access (user_id, company_id, role)
select p.user_id, c.id, 'editor'
from public.user_profiles p
cross join public.companies c
where p.active = true
  and p.role <> 'admin_ribera'
  and lower(c.name) <> lower('Ribera Audiovisual')
on conflict (user_id, company_id) do nothing;

-- Ribera admin recibe acceso admin a todas las empresas.
insert into public.user_company_access (user_id, company_id, role)
select p.user_id, c.id, 'admin'
from public.user_profiles p
cross join public.companies c
where p.email = 'ribera.audiovisuales@gmail.com'
on conflict (user_id, company_id) do update set role = 'admin', updated_at = now();

-- Asegura la empresa interna Ribera con color/logo.
insert into public.companies (name, color, logo_url)
values ('Ribera Audiovisual', '#0b0b0d', 'ribera-logo.png')
on conflict (name) do update set color = excluded.color, logo_url = excluded.logo_url;

-- Si Ribera existe luego del insert anterior, darle acceso al admin.
insert into public.user_company_access (user_id, company_id, role)
select p.user_id, c.id, 'admin'
from public.user_profiles p
join public.companies c on lower(c.name) = lower('Ribera Audiovisual')
where p.email = 'ribera.audiovisuales@gmail.com'
on conflict (user_id, company_id) do update set role = 'admin', updated_at = now();

-- ─────────────────────────────────────────────
-- Helpers de seguridad
-- ─────────────────────────────────────────────
create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_ribera_email()
returns boolean
language sql
stable
as $$
  select public.current_user_email() = 'ribera.audiovisuales@gmail.com';
$$;

create or replace function public.is_ribera_company_name(company_name text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(company_name, '')) = lower('Ribera Audiovisual');
$$;

create or replace function public.is_ribera_company_id(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = company_uuid
      and public.is_ribera_company_name(c.name)
  );
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_ribera_email()
    or exists (
      select 1
      from public.user_profiles p
      where p.user_id = auth.uid()
        and p.active = true
        and p.role = 'admin_ribera'
    );
$$;

create or replace function public.has_ribera_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles p
      where p.user_id = auth.uid()
        and p.active = true
        and p.ribera_access = true
    );
$$;

create or replace function public.can_manage_companies()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles p
      where p.user_id = auth.uid()
        and p.active = true
        and p.can_manage_companies = true
    );
$$;

create or replace function public.can_delete_records()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles p
      where p.user_id = auth.uid()
        and p.active = true
        and p.can_delete = true
    );
$$;

create or replace function public.can_read_company(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or public.can_manage_companies()
    or exists (
      select 1
      from public.user_profiles p
      join public.user_company_access a on a.user_id = p.user_id
      join public.companies c on c.id = a.company_id
      where p.user_id = auth.uid()
        and p.active = true
        and a.company_id = company_uuid
        and (not public.is_ribera_company_name(c.name) or p.ribera_access = true)
    );
$$;

create or replace function public.can_write_company(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles p
      join public.user_company_access a on a.user_id = p.user_id
      join public.companies c on c.id = a.company_id
      where p.user_id = auth.uid()
        and p.active = true
        and a.company_id = company_uuid
        and a.role in ('admin','editor')
        and (not public.is_ribera_company_name(c.name) or p.ribera_access = true)
    );
$$;

create or replace function public.can_admin_company(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles p
      join public.user_company_access a on a.user_id = p.user_id
      where p.user_id = auth.uid()
        and p.active = true
        and a.company_id = company_uuid
        and a.role = 'admin'
    );
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.user_profiles enable row level security;
alter table public.user_company_access enable row level security;
alter table public.companies enable row level security;
alter table public.content_items enable row level security;
alter table public.assets enable row level security;
alter table public.prospects enable row level security;

-- Limpieza de políticas anteriores abiertas y de Ribera v1.
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('companies','content_items','assets','prospects','user_profiles','user_company_access')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Profiles
create policy "profiles_select_own_or_admin" on public.user_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_admin_user());

create policy "profiles_insert_admin" on public.user_profiles
for insert to authenticated
with check (public.is_admin_user());

create policy "profiles_update_admin" on public.user_profiles
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "profiles_delete_admin" on public.user_profiles
for delete to authenticated
using (public.is_admin_user() and user_id <> auth.uid());

-- Company access table
create policy "access_select_own_or_admin" on public.user_company_access
for select to authenticated
using (user_id = auth.uid() or public.is_admin_user());

create policy "access_insert_admin" on public.user_company_access
for insert to authenticated
with check (public.is_admin_user());

create policy "access_update_admin" on public.user_company_access
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "access_delete_admin" on public.user_company_access
for delete to authenticated
using (public.is_admin_user());

-- Companies
create policy "companies_select_by_access" on public.companies
for select to authenticated
using (public.can_read_company(id));

create policy "companies_insert_managers" on public.companies
for insert to authenticated
with check (public.can_manage_companies() and (not public.is_ribera_company_name(name) or public.has_ribera_access()));

create policy "companies_update_managers_or_company_admin" on public.companies
for update to authenticated
using (public.can_manage_companies() or public.can_admin_company(id))
with check (public.can_manage_companies() or public.can_admin_company(id));

create policy "companies_delete_managers" on public.companies
for delete to authenticated
using (public.can_manage_companies() and not public.is_ribera_company_name(name));

-- Content
create policy "content_select_by_company_access" on public.content_items
for select to authenticated
using (public.can_read_company(company_id));

create policy "content_insert_by_company_write" on public.content_items
for insert to authenticated
with check (public.can_write_company(company_id));

create policy "content_update_by_company_write" on public.content_items
for update to authenticated
using (public.can_write_company(company_id) or public.can_manage_companies())
with check (public.can_write_company(company_id) or public.can_manage_companies());

create policy "content_delete_by_company_write_and_delete_flag" on public.content_items
for delete to authenticated
using ((public.can_write_company(company_id) or public.can_manage_companies()) and public.can_delete_records());

-- Assets
create policy "assets_select_by_company_access" on public.assets
for select to authenticated
using (public.can_read_company(company_id));

create policy "assets_insert_by_company_write" on public.assets
for insert to authenticated
with check (public.can_write_company(company_id));

create policy "assets_update_by_company_write" on public.assets
for update to authenticated
using (public.can_write_company(company_id) or public.can_manage_companies())
with check (public.can_write_company(company_id) or public.can_manage_companies());

create policy "assets_delete_by_company_write_and_delete_flag" on public.assets
for delete to authenticated
using ((public.can_write_company(company_id) or public.can_manage_companies()) and public.can_delete_records());

-- Prospects: nivel interno Ribera
create policy "prospects_select_ribera_level" on public.prospects
for select to authenticated
using (public.has_ribera_access());

create policy "prospects_insert_ribera_level" on public.prospects
for insert to authenticated
with check (public.has_ribera_access());

create policy "prospects_update_ribera_level" on public.prospects
for update to authenticated
using (public.has_ribera_access())
with check (public.has_ribera_access());

create policy "prospects_delete_ribera_level" on public.prospects
for delete to authenticated
using (public.has_ribera_access() and public.can_delete_records());

-- Realtime opcional
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_company_access') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_company_access;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
