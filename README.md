# Ribera Content Hub — Final operativo

Versión final de trabajo con Supabase, roles/RLS, calendario operativo y flujo de producción por contenido.

## Qué incluye

- Login con Supabase Auth.
- Empresas/clientes compartidos.
- Roles y permisos por empresa.
- Ribera Audiovisual con acceso especial para `ribera.audiovisuales@gmail.com`.
- Calendario operativo con click en día para crear contenido.
- Fijación de contenido por rango de fechas.
- Estados visuales: idea, producción, revisión/edición, terminado y deadline interno.
- Checklist de producción por contenido.
- Campo “Qué se va a usar”.
- Asociación de assets de biblioteca a contenidos.
- Vista de assets asociados al abrir un contenido.
- Comentarios internos por contenido.
- Dashboard interno de Ribera.
- Alertas visuales dentro del hub.
- Corrección del bug de regreso al selector al cambiar de pestaña del navegador.

## Archivos a subir a GitHub Pages

Subí estos archivos:

- `index.html`
- `app.js`
- `styles.css`
- `ribera-logo.png`
- tu `config.js` actual

No pises `config.js` si ya funciona.

## Migraciones necesarias en Supabase

Ejecutar en este orden, según lo que ya tengas cargado:

1. `migration_roles_rls.sql`
2. `migration_calendar_ranges.sql`
3. `migration_final_operativo.sql`

Si ya ejecutaste las dos primeras, solo ejecutá:

```sql
migration_final_operativo.sql
```

## Verificación rápida

Después de subir:

1. Abrí la web con `?v=final` al final de la URL.
2. Entrá con `ribera.audiovisuales@gmail.com`.
3. Entrá a Ribera Audiovisual.
4. Abrí un contenido y verificá:
   - Checklist de producción.
   - Qué se va a usar.
   - Assets asociados.
   - Comentarios.
5. Cambiá a otra pestaña del navegador y volvé: no debería enviarte al selector de empresa.

## Nota operativa

Los assets asociados se toman desde Biblioteca. Para ver imágenes de referencia dentro del contenido, cargá primero el asset como Foto/Referencia con un link directo a imagen o archivo visual accesible.

## Versión final 100% — multicanal y fases

Además de las migraciones anteriores, ejecutar:

`migration_final_100_multicanal_fases.sql`

Agrega:

- múltiples canales por contenido (`channels`),
- múltiples tipos de contenido (`content_types`),
- agenda de tiempo de idea,
- agenda de tiempo de producción,
- agenda de tiempo de edición/revisión.

El calendario muestra estas fases como bloques visuales independientes de la fijación/publicación.


## Final 101 - Hardfix multicanal y fases

Subir a GitHub Pages:

- `index.html`
- `app.js`
- `styles.css`
- `ribera-logo.png`

No pisar `config.js`.

Ejecutar en Supabase SQL Editor:

- `migration_final_101_repair.sql`

Esta migración consolida checklist, recursos a usar, assets asociados, comentarios, múltiples canales, múltiples tipos y fechas por fase: idea, producción, edición/revisión.

Abrir la web con `?v=final101` para evitar caché viejo de GitHub Pages. En Config debe aparecer el build `final-101-hardfix-multicanal-fases-operativo-202605`.
