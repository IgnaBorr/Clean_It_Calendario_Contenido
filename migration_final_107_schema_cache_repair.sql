-- Ribera Content Hub — Final 107 Schema Repair
-- Repara columnas faltantes para aprobaciones, fases, multicanal, elementos de producción y entregables.
-- Ejecutar en Supabase SQL Editor. Es idempotente: se puede correr más de una vez.

alter table public.content_items
  add column if not exists publish_end_date date,
  add column if not exists publish_time text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists resources_to_use text,
  add column if not exists channels text[] not null default '{}'::text[],
  add column if not exists content_types text[] not null default '{}'::text[],
  add column if not exists idea_start_date date,
  add column if not exists idea_end_date date,
  add column if not exists production_start_date date,
  add column if not exists production_end_date date,
  add column if not exists review_start_date date,
  add column if not exists review_end_date date,
  add column if not exists client_piece_approved_at timestamptz,
  add column if not exists client_piece_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists client_idea_approved_at timestamptz,
  add column if not exists client_idea_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists production_elements jsonb not null default '[]'::jsonb,
  add column if not exists planned_deliverables jsonb not null default '[]'::jsonb;

-- Migración suave desde columnas viejas si existen.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='channel'
  ) then
    update public.content_items
    set channels = case
      when (channels is null or cardinality(channels) = 0) and coalesce(channel,'') <> '' then array[channel]
      when channels is null then '{}'::text[]
      else channels
    end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='content_type'
  ) then
    update public.content_items
    set content_types = case
      when (content_types is null or cardinality(content_types) = 0) and coalesce(content_type,'') <> '' then array[content_type]
      when content_types is null then '{}'::text[]
      else content_types
    end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_items' and column_name='publish_date'
  ) then
    update public.content_items
    set publish_end_date = coalesce(publish_end_date, publish_date)
    where publish_date is not null and publish_end_date is null;
  end if;
end $$;

-- Índices útiles.
create index if not exists idx_content_items_publish_end_date on public.content_items(publish_end_date);
create index if not exists idx_content_items_channels_gin on public.content_items using gin(channels);
create index if not exists idx_content_items_content_types_gin on public.content_items using gin(content_types);
create index if not exists idx_content_items_client_piece_approved_at on public.content_items(client_piece_approved_at);
create index if not exists idx_content_items_client_idea_approved_at on public.content_items(client_idea_approved_at);
create index if not exists idx_content_items_production_elements_gin on public.content_items using gin(production_elements);
create index if not exists idx_content_items_planned_deliverables_gin on public.content_items using gin(planned_deliverables);

-- Forzar recarga del schema cache de PostgREST/Supabase.
notify pgrst, 'reload schema';
