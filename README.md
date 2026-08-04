# Kaizen Bigbuda

Plataforma interna de mejora continua del área de Marketing de Bigbuda. Ver `CLAUDE.md` para el brief funcional completo.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth) vía `@supabase/supabase-js` y `@supabase/ssr`

## Desarrollo local

1. Copiar variables de entorno a `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

2. Instalar dependencias y levantar el servidor:

   ```bash
   npm install
   npm run dev
   ```

3. Verificar la conexión a Supabase sin levantar la app:

   ```bash
   node scripts/verify-supabase.mjs
   ```
