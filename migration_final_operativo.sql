-- Ribera Content Hub - Final operativo de producción
-- Ejecutar después de migration_roles_rls.sql y migration_calendar_ranges.sql.

-- ─────────────────────────────────────────────
-- Campos operativos por contenido
-- ─────────────────────────────────────────────
alter table public.content_items
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.content_items
  add column if not exists resources_to_use text;

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

-- Limpiar políticas previas para esta migración.
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

-- Assets asociados: lectura por acceso a la empresa del contenido.
create policy "content_asset_links_select_by_content_company" on public.content_asset_links
for select to authenticated
using (
  exists (
    select 1
    from public.content_items ci
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
    select 1
    from public.content_items ci
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
    select 1
    from public.content_items ci
    where ci.id = content_asset_links.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

-- Comentarios: lectura por acceso, escritura por permiso de edición.
create policy "content_comments_select_by_content_company" on public.content_comments
for select to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_read_company(ci.company_id)
  )
);

create policy "content_comments_insert_by_content_write" on public.content_comments
for insert to authenticated
with check (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

create policy "content_comments_update_by_content_write" on public.content_comments
for update to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
)
with check (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

create policy "content_comments_delete_by_content_write" on public.content_comments
for delete to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_comments.content_item_id
      and public.can_write_company(ci.company_id)
  )
);

-- Realtime para sincronización entre navegadores.
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
