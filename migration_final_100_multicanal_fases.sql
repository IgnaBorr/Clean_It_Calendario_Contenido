-- Ribera Content Hub - Final 100% multicanal + fases por producción
-- Ejecutar después de migration_final_operativo.sql.

-- Múltiples canales y múltiples tipos por contenido.
alter table public.content_items
  add column if not exists channels text[] not null default '{}'::text[];

alter table public.content_items
  add column if not exists content_types text[] not null default '{}'::text[];

-- Fechas de trabajo por etapa de una misma tarea.
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

-- Backfill: conserva compatibilidad con los campos viejos channel/content_type.
update public.content_items
set channels = case
  when (channels is null or cardinality(channels) = 0) and coalesce(channel,'') <> '' then array[channel]
  else channels
end,
content_types = case
  when (content_types is null or cardinality(content_types) = 0) and coalesce(content_type,'') <> '' then array[content_type]
  else content_types
end;

-- Índices útiles para búsqueda/filtros futuros.
create index if not exists idx_content_items_channels_gin on public.content_items using gin(channels);
create index if not exists idx_content_items_content_types_gin on public.content_items using gin(content_types);
create index if not exists idx_content_items_idea_dates on public.content_items(idea_start_date, idea_end_date);
create index if not exists idx_content_items_production_dates on public.content_items(production_start_date, production_end_date);
create index if not exists idx_content_items_review_dates on public.content_items(review_start_date, review_end_date);
