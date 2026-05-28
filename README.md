# Ribera Content Hub — Final 104

Versión operativa con Supabase, roles/RLS, calendario, biblioteca, entregables, comentarios, assets asociados, checklist de producción, múltiples canales/tipos y flujo correcto de aprobación.

## Subir a GitHub Pages

Subir estos archivos:

- `index.html`
- `app.js`
- `styles.css`
- `ribera-logo.png`
- `config.js` solamente si todavía no existe en tu repositorio.

No pises tu `config.js` si ya está funcionando con tu URL y anon key de Supabase.

## Supabase

Ejecutar en SQL Editor la migración nueva:

- `migration_final_104_cliente_aprueba_ribera_publica.sql`

Si venís de versiones anteriores y ya ejecutaste todas las migraciones previas, con esta alcanza.

## Cambio clave de esta versión

La aprobación del cliente no cambia automáticamente el estado a `Publicado`.

Flujo correcto:

1. Idea aprobada por cliente → pasa a producción.
2. Producción → pasa a edición/revisión.
3. Cliente aprueba la pieza → queda marcada como aprobada.
4. Ribera marca manualmente el contenido como publicado.

## Cache

Abrir con:

`?v=final104`
