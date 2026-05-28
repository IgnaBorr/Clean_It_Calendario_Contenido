-- Migración: calendario operativo con fijaciones de varios días
-- Ejecutar en Supabase SQL Editor después de las migraciones anteriores.

alter table public.content_items
  add column if not exists publish_end_date date;

create index if not exists idx_content_items_publish_end_date
  on public.content_items(publish_end_date);

-- Normaliza registros existentes: si tienen fecha de publicación pero no fecha fin,
-- la fecha fin queda igual a la fecha de inicio.
update public.content_items
set publish_end_date = publish_date
where publish_date is not null
  and publish_end_date is null;
