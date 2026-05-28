# Ribera Content Hub — versión cliente plan final

Build: `cliente-plan-final-202605`

## Qué incluye

- Roles, usuarios y permisos por empresa.
- RLS robusto en Supabase.
- Calendario operativo con click en día para crear contenido.
- Fases por contenido: idea, producción, edición/revisión y fijación/publicación.
- Múltiples canales por contenido.
- Múltiples tipos por contenido.
- Ficha visual de contenido orientada a cliente.
- Línea visual de estado del contenido.
- Entregables por versión con reproductor embebido cuando el link lo permite.
- Assets asociados desde Biblioteca.
- Comentarios por contenido.
- Lista mensual debajo del calendario.
- Kanban filtrable por mes y tipo.

## Archivos a subir a GitHub Pages

Subir:

- `index.html`
- `app.js`
- `styles.css`
- `ribera-logo.png`

No pisar:

- `config.js`

## SQL requerido

Ejecutar en Supabase SQL Editor:

1. `migration_roles_rls.sql`, si todavía no lo ejecutaste.
2. `migration_cliente_plan_final.sql`.

Después abrir la web con:

```text
?v=cliente-plan-final
```

## Nota sobre reproductor

Los entregables se reproducen dentro del hub cuando el link lo permite:

- YouTube: embed directo.
- Google Drive archivo compartido: se transforma a `/preview`.
- MP4/WebM directo: reproductor HTML5.
- Imágenes directas: preview de imagen.

Si Google Drive no deja reproducir, revisar que el archivo esté compartido con permiso de visualización.
