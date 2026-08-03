# Kaizen Bigbuda

Plataforma interna de mejora continua del área de Marketing de Bigbuda. Ver `CLAUDE.md` para el brief completo del proyecto.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth) vía `@supabase/ssr`

## Estado

Scaffold inicial. **Aún no hay pantallas ni componentes de UI construidos**: se está a la espera de sincronizar el diseño aprobado desde Claude Design (tokens y componentes) antes de construir cualquier vista.

## Desarrollo

```bash
cp .env.example .env.local   # completar credenciales de Supabase
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Estructura

```
app/                  App Router (layout + páginas)
lib/supabase/         Clientes de Supabase (browser, server) y helper de sesión
proxy.ts              Refresco de sesión de Supabase (reemplaza a middleware.ts en Next 16)
```
