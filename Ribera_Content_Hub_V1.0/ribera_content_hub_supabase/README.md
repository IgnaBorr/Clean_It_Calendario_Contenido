# Ribera Content Hub + Supabase

Versión para GitHub Pages con base compartida en Supabase.

## Qué cambia en esta versión

- El login ya no dice Clean It Hub. Ahora dice **Ribera Content Hub**.
- La empresa interna **Ribera Audiovisual** aparece únicamente para el usuario:

```txt
ribera.audiovisuales@gmail.com
```

- Dentro de **Ribera Audiovisual** aparece una pestaña exclusiva: **Posibles clientes**.
- El resto de empresas conserva calendario, kanban, ideas, biblioteca, métricas y configuración.
- La seguridad no queda solo en la interfaz: el archivo `migration_ribera.sql` ajusta RLS para que Ribera Audiovisual y la tabla de prospectos queden restringidas en Supabase.

## Archivos principales

- `index.html`: estructura de la app.
- `styles.css`: estilos.
- `app.js`: lógica de Supabase y vistas.
- `config.example.js`: ejemplo de configuración.
- `config.js`: tu configuración local, completar con tus credenciales.
- `migration_ribera.sql`: ejecutar si ya tenías la versión anterior funcionando.
- `schema.sql`: esquema completo para instalación nueva.

## Si ya tenés la versión anterior funcionando

1. Subí/actualizá en GitHub Pages:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`

2. En Supabase abrí:

```txt
SQL Editor > New query
```

3. Pegá y ejecutá el contenido completo de:

```txt
migration_ribera.sql
```

4. En Supabase Auth verificá que exista este usuario:

```txt
ribera.audiovisuales@gmail.com
```

5. Entrá con ese usuario. Vas a ver la opción **Ribera Audiovisual**.

## Si es una instalación desde cero

1. Crear proyecto en Supabase.
2. Ejecutar `schema.sql` completo.
3. Crear usuarios desde Authentication.
4. Copiar `config.example.js` como `config.js`.
5. Completar `url` y `anonKey`.
6. Subir archivos a GitHub Pages.

## Seguridad

La app usa Supabase Auth + Row Level Security.

- Usuarios autenticados normales pueden trabajar con empresas comunes.
- Solo `ribera.audiovisuales@gmail.com` puede ver y modificar **Ribera Audiovisual**.
- Solo `ribera.audiovisuales@gmail.com` puede ver y modificar **Posibles clientes**.
- **Ribera Audiovisual no se puede eliminar** desde la app.

