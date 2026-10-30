/**
 * URL pública de la app, sin barra final. `NEXT_PUBLIC_APP_URL` suele quedar con "/" al final al pegarla
 * en Vercel (`https://kaizen.bigbuda.com/`); al concatenar rutas eso produce `//` — y el redirect_uri de
 * Google OAuth con doble barra no coincide con el autorizado (`redirect_uri_mismatch`).
 */
export function urlApp(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}
