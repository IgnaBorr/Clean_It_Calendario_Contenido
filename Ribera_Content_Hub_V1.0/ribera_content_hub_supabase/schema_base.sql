-- Clean It Content Hub + Supabase
-- Ejecutar completo en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Empresas / clientes
-- ─────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#1a6ff4',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Contenidos / ideas / calendario
-- ─────────────────────────────────────────────
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  title text not null,
  description text,
  channel text,
  content_type text,
  status text not null default 'idea' check (status in ('idea','produccion','revision','publicado')),
  idea_stage text default 'cruda' check (idea_stage in ('cruda','validada','futura','descartada')),
  priority text default 'media' check (priority in ('alta','media','baja')),
  owner text,
  next_action text,
  internal_deadline date,
  publish_date date,
  link_url text,
  tags text,
  development text,
  approved boolean,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_items_company_id on public.content_items(company_id);
create index if not exists idx_content_items_status on public.content_items(status);
create index if not exists idx_content_items_internal_deadline on public.content_items(internal_deadline);
create index if not exists idx_content_items_publish_date on public.content_items(publish_date);

drop trigger if exists trg_content_items_updated_at on public.content_items;
create trigger trg_content_items_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Biblioteca de assets
-- ─────────────────────────────────────────────
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  type text default 'Otro',
  name text not null,
  link_url text,
  usage text,
  tags text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_company_id on public.assets(company_id);
create index if not exists idx_assets_type on public.assets(type);

drop trigger if exists trg_assets_updated_at on public.assets;
create trigger trg_assets_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security
-- Política simple para equipo chico:
-- cualquier usuario autenticado puede leer/escribir todo el hub.
-- No habilites signups públicos salvo que quieras que cualquiera con cuenta modifique datos.
-- ─────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.content_items enable row level security;
alter table public.assets enable row level security;

-- Companies policies
drop policy if exists "authenticated_select_companies" on public.companies;
drop policy if exists "authenticated_insert_companies" on public.companies;
drop policy if exists "authenticated_update_companies" on public.companies;
drop policy if exists "authenticated_delete_companies" on public.companies;

create policy "authenticated_select_companies" on public.companies
for select to authenticated using (true);
create policy "authenticated_insert_companies" on public.companies
for insert to authenticated with check (true);
create policy "authenticated_update_companies" on public.companies
for update to authenticated using (true) with check (true);
create policy "authenticated_delete_companies" on public.companies
for delete to authenticated using (true);

-- Content policies
drop policy if exists "authenticated_select_content" on public.content_items;
drop policy if exists "authenticated_insert_content" on public.content_items;
drop policy if exists "authenticated_update_content" on public.content_items;
drop policy if exists "authenticated_delete_content" on public.content_items;

create policy "authenticated_select_content" on public.content_items
for select to authenticated using (true);
create policy "authenticated_insert_content" on public.content_items
for insert to authenticated with check (true);
create policy "authenticated_update_content" on public.content_items
for update to authenticated using (true) with check (true);
create policy "authenticated_delete_content" on public.content_items
for delete to authenticated using (true);

-- Asset policies
drop policy if exists "authenticated_select_assets" on public.assets;
drop policy if exists "authenticated_insert_assets" on public.assets;
drop policy if exists "authenticated_update_assets" on public.assets;
drop policy if exists "authenticated_delete_assets" on public.assets;

create policy "authenticated_select_assets" on public.assets
for select to authenticated using (true);
create policy "authenticated_insert_assets" on public.assets
for insert to authenticated with check (true);
create policy "authenticated_update_assets" on public.assets
for update to authenticated using (true) with check (true);
create policy "authenticated_delete_assets" on public.assets
for delete to authenticated using (true);

-- ─────────────────────────────────────────────
-- Datos base
-- ─────────────────────────────────────────────
insert into public.companies (name, color)
values
  ('Clean It', '#1a6ff4'),
  ('Mundo Chipa', '#f28c28'),
  ('La Clasica', '#2f7d5a')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────
-- Realtime opcional para sincronizar dos navegadores abiertos.
-- Si ya estaban agregadas a la publicación, no hace nada.
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'companies') then
    alter publication supabase_realtime add table public.companies;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_items') then
    alter publication supabase_realtime add table public.content_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assets') then
    alter publication supabase_realtime add table public.assets;
  end if;
end $$;
