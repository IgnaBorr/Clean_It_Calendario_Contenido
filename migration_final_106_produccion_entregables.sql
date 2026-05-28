-- Ribera Content Hub — Final 106
-- Separa elementos de producción y entregables previstos.
-- No borra checklist anterior; lo deja como compatibilidad histórica.

alter table public.content_items
  add column if not exists production_elements jsonb not null default '[]'::jsonb;

alter table public.content_items
  add column if not exists planned_deliverables jsonb not null default '[]'::jsonb;

create index if not exists idx_content_items_production_elements_gin
  on public.content_items using gin(production_elements);

create index if not exists idx_content_items_planned_deliverables_gin
  on public.content_items using gin(planned_deliverables);
