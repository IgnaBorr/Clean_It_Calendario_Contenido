-- Ribera Content Hub — Final 104
-- La aprobación del cliente NO publica el contenido.
-- El cliente aprueba la pieza y Ribera marca el estado como publicado después.

alter table public.content_items
  add column if not exists client_piece_approved_at timestamptz;

alter table public.content_items
  add column if not exists client_piece_approved_by uuid references auth.users(id) on delete set null;

create index if not exists idx_content_items_client_piece_approved_at
  on public.content_items(client_piece_approved_at);
