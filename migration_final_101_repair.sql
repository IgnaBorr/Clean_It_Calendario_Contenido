-- Ribera Content Hub - Final 101 Repair
-- Ejecutar después de migration_roles_rls.sql.
-- Esta migración consolida la versión final: calendario por rangos, checklist, assets asociados,
-- comentarios, múltiples canales/tipos y fases de trabajo.

-- ─────────────────────────────────────────────
-- Columnas finales de content_items
-- ─────────────────────────────────────────────
alter table public.content_items
  add column if not exists publish_end_date date;

alter table public.content_items
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.content_items
  add column if not exists resources_to_use text;

alter table public.content_items
  add column if not exists channels text[] not null default '{}'::text[];

alter table public.content_items
  add column if not exists content_types text[] not null default '{}'::text[];

alter table public.content_items
  add column if not exists idea_start_date date;

alter table public.content_items
  add column if not exists idea_end_date date;

alter table public.content_items
  add column if not exists production_start_date date;

alter table public.content_items
  add column if not exists production_end_date date;

alter table public.content_items
  add column if not exists review_start_date date;

alter table public.content_items
  add column if not exists review_end_date date;

-- Backfill compatible con versiones anteriores.
update public.content_items
set
  publish_end_date = coalesce(publish_end_date, publish_date),
  channels = case
    when (channels is null or cardinality(channels) = 0) and coalesce(channel,'') <> '' then array[channel]
    when channels is null then '{}'::text[]
    else channels
  end,
  content_types = case
    when (content_types is null or cardinality(content_types) = 0) and coalesce(content_type,'') <> '' then array[content_type]
    when content_types is null then '{}'::text[]
    else content_types
  end;

create index if not exists idx_content_items_publish_end_date on public.content_items(publish_end_date);
create index if not exists idx_content_items_channels_gin on public.content_items using gin(channels);
create index if not exists idx_content_items_content_types_gin on public.content_items using gin(content_types);
create index if not exists idx_content_items_idea_dates on public.content_items(idea_start_date, idea_end_date);
create index if not exists idx_content_items_production_dates on public.content_items(production_start_date, production_end_date);
create index if not exists idx_content_items_review_dates on public.content_items(review_start_date, review_end_date);

-- ─────────────────────────────────────────────
-- Assets asociados a contenidos
-- ─────────────────────────────────────────────
create table if not exists public.content_asset_links (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role text default 'referencia',
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(content_item_id, asset_id)
);

create index if not exists idx_content_asset_links_content on public.content_asset_links(content_item_id);
create index if not exists idx_content_asset_links_asset on public.content_asset_links(asset_id);

-- ─────────────────────────────────────────────
-- Comentarios por contenido
-- ─────────────────────────────────────────────
create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_email text default ((auth.jwt() ->> 'email')),
  created_at timestamptz not null default now()
);

create index if not exists idx_content_comments_content on public.content_comments(content_item_id);
create index if not exists idx_content_comments_created_at on public.content_comments(created_at);

alter table public.content_asset_links enable row level security;
alter table public.content_comments enable row level security;

-- Limpiar políticas previas de estas tablas para evitar duplicados.
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('content_asset_links','content_comments')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "content_asset_links_select_by_content_company" on public.content_asset_links
for select to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_asset_links.content_item_id
      and public.can_read_company(ci.company_id)
  )
);

create policy "content_asset_links_insert_by_content_write" on public.content_asset_links
for insert to authenticated
with check (
  exists (
    select 1
    from public.content_items ci
    join public.assets a on a.id = content_asset_links.asset_id
    where ci.id = content_asset_links.content_item_id
      and public.can_write_company(ci.company_id)
      and a.company_id = ci.company_id
  )
);

create policy "content_asset_links_update_by_content_write" on public.content_asset_links
for update to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_asset_links.content_item_id
      and public.can_write_company(ci.company_id)
  )
)
with check (
  exists (
    select 1
    from public.content_items ci
    join public.assets a on a.id = content_asset_links.asset_id
    where ci.id = content_asset_links.content_item_id
      and public.can_write_company(ci.company_id)
      and a.company_id = ci.company_id
  )
);

create policy "content_asset_links_delete_by_content_write" on public.content_asset_links
for delete to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_asset_links.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

create policy "content_comments_select_by_content_company" on public.content_comments
for select to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_read_company(ci.company_id)
  )
);

create policy "content_comments_insert_by_content_write" on public.content_comments
for insert to authenticated
with check (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

create policy "content_comments_update_by_content_write" on public.content_comments
for update to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
)
with check (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

create policy "content_comments_delete_by_content_write" on public.content_comments
for delete to authenticated
using (
  exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

-- Realtime opcional para sincronizar navegadores.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_asset_links') then
      alter publication supabase_realtime add table public.content_asset_links;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_comments') then
      alter publication supabase_realtime add table public.content_comments;
    end if;
  end if;
end $$;

-- Forzar recarga de schema cache en Supabase/PostgREST.
select pg_notify('pgrst', 'reload schema');
