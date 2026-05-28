-- Ribera Content Hub - capa interna Ribera Audiovisual
-- Ejecutar en Supabase > SQL Editor > New query > Run.
-- Aplica sobre el esquema anterior del Content Hub.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Cuenta interna Ribera
-- ─────────────────────────────────────────────
insert into public.companies (name, color)
values ('Ribera Audiovisual', '#101828')
on conflict (name) do update set color = excluded.color;

-- ─────────────────────────────────────────────
-- Helpers de seguridad
-- ─────────────────────────────────────────────
create or replace function public.is_ribera_user()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'ribera.audiovisuales@gmail.com';
$$;

create or replace function public.is_ribera_company_name(company_name text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(company_name, '')) = lower('Ribera Audiovisual');
$$;

create or replace function public.can_access_company_name(company_name text)
returns boolean
language sql
stable
as $$
  select not public.is_ribera_company_name(company_name) or public.is_ribera_user();
$$;

create or replace function public.can_access_company_id(company_uuid uuid)
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
      and public.can_access_company_name(c.name)
  );
$$;

-- ─────────────────────────────────────────────
-- Posibles clientes / pipeline comercial Ribera
-- ─────────────────────────────────────────────
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_channel text,
  phone text,
  email text,
  service_interest text,
  status text not null default 'Prospecto' check (status in ('Prospecto','Contactado','Reunión agendada','Propuesta enviada','Ganado','Perdido')),
  estimated_value numeric,
  next_action text,
  next_contact_date date,
  link_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospects_status on public.prospects(status);
create index if not exists idx_prospects_next_contact_date on public.prospects(next_contact_date);

-- Usa la función set_updated_at del esquema base. Si no existe, la crea.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prospects_updated_at on public.prospects;
create trigger trg_prospects_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

alter table public.prospects enable row level security;

-- ─────────────────────────────────────────────
-- Reemplazo de políticas abiertas por políticas con nivel Ribera
-- ─────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.content_items enable row level security;
alter table public.assets enable row level security;

-- Companies policies
DROP POLICY IF EXISTS "authenticated_select_companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated_insert_companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated_update_companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated_delete_companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select_visible" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_visible" ON public.companies;
DROP POLICY IF EXISTS "companies_update_visible" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_visible" ON public.companies;

CREATE POLICY "companies_select_visible" ON public.companies
FOR SELECT TO authenticated
USING (public.can_access_company_name(name));

CREATE POLICY "companies_insert_visible" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (public.can_access_company_name(name));

CREATE POLICY "companies_update_visible" ON public.companies
FOR UPDATE TO authenticated
USING (public.can_access_company_name(name))
WITH CHECK (public.can_access_company_name(name));

-- Ribera Audiovisual es una cuenta interna fija: no se elimina.
CREATE POLICY "companies_delete_visible" ON public.companies
FOR DELETE TO authenticated
USING (not public.is_ribera_company_name(name));

-- Content policies
DROP POLICY IF EXISTS "authenticated_select_content" ON public.content_items;
DROP POLICY IF EXISTS "authenticated_insert_content" ON public.content_items;
DROP POLICY IF EXISTS "authenticated_update_content" ON public.content_items;
DROP POLICY IF EXISTS "authenticated_delete_content" ON public.content_items;
DROP POLICY IF EXISTS "content_select_visible" ON public.content_items;
DROP POLICY IF EXISTS "content_insert_visible" ON public.content_items;
DROP POLICY IF EXISTS "content_update_visible" ON public.content_items;
DROP POLICY IF EXISTS "content_delete_visible" ON public.content_items;

CREATE POLICY "content_select_visible" ON public.content_items
FOR SELECT TO authenticated
USING (public.can_access_company_id(company_id));

CREATE POLICY "content_insert_visible" ON public.content_items
FOR INSERT TO authenticated
WITH CHECK (public.can_access_company_id(company_id));

CREATE POLICY "content_update_visible" ON public.content_items
FOR UPDATE TO authenticated
USING (public.can_access_company_id(company_id))
WITH CHECK (public.can_access_company_id(company_id));

CREATE POLICY "content_delete_visible" ON public.content_items
FOR DELETE TO authenticated
USING (public.can_access_company_id(company_id));

-- Asset policies
DROP POLICY IF EXISTS "authenticated_select_assets" ON public.assets;
DROP POLICY IF EXISTS "authenticated_insert_assets" ON public.assets;
DROP POLICY IF EXISTS "authenticated_update_assets" ON public.assets;
DROP POLICY IF EXISTS "authenticated_delete_assets" ON public.assets;
DROP POLICY IF EXISTS "assets_select_visible" ON public.assets;
DROP POLICY IF EXISTS "assets_insert_visible" ON public.assets;
DROP POLICY IF EXISTS "assets_update_visible" ON public.assets;
DROP POLICY IF EXISTS "assets_delete_visible" ON public.assets;

CREATE POLICY "assets_select_visible" ON public.assets
FOR SELECT TO authenticated
USING (public.can_access_company_id(company_id));

CREATE POLICY "assets_insert_visible" ON public.assets
FOR INSERT TO authenticated
WITH CHECK (public.can_access_company_id(company_id));

CREATE POLICY "assets_update_visible" ON public.assets
FOR UPDATE TO authenticated
USING (public.can_access_company_id(company_id))
WITH CHECK (public.can_access_company_id(company_id));

CREATE POLICY "assets_delete_visible" ON public.assets
FOR DELETE TO authenticated
USING (public.can_access_company_id(company_id));

-- Prospects policies: solo Ribera
DROP POLICY IF EXISTS "ribera_select_prospects" ON public.prospects;
DROP POLICY IF EXISTS "ribera_insert_prospects" ON public.prospects;
DROP POLICY IF EXISTS "ribera_update_prospects" ON public.prospects;
DROP POLICY IF EXISTS "ribera_delete_prospects" ON public.prospects;

CREATE POLICY "ribera_select_prospects" ON public.prospects
FOR SELECT TO authenticated
USING (public.is_ribera_user());

CREATE POLICY "ribera_insert_prospects" ON public.prospects
FOR INSERT TO authenticated
WITH CHECK (public.is_ribera_user());

CREATE POLICY "ribera_update_prospects" ON public.prospects
FOR UPDATE TO authenticated
USING (public.is_ribera_user())
WITH CHECK (public.is_ribera_user());

CREATE POLICY "ribera_delete_prospects" ON public.prospects
FOR DELETE TO authenticated
USING (public.is_ribera_user());

-- Realtime opcional
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'prospects') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prospects;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
