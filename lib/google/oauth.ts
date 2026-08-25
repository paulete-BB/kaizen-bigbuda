import crypto from "node:crypto";
import { sql } from "@/lib/db";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PkceState {
  verifier: string;
  challenge: string;
  state: string;
}

/** Genera el par verifier/challenge de PKCE (RFC 7636) para el flujo Authorization Code — reemplaza el implicit flow del dashboard original, que no tenía refresh token. */
export function generarPkce(): PkceState {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));
  return { verifier, challenge, state };
}

function redirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL no configurado — necesario para el redirect_uri de Google OAuth");
  return `${appUrl}/api/auth/google/callback`;
}

export function construirUrlAutorizacion(pkce: PkceState): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID no configurado");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Fuerza pantalla de consentimiento en cada conexión: Google solo
    // devuelve refresh_token la primera vez salvo que se pida explícito.
    prompt: "consent",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    state: pkce.state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

/** Intercambia el código de autorización por tokens — guarda el refresh_token en settings (única conexión de la agencia, no por cliente). */
export async function intercambiarCodigoPorTokens(code: string, verifier: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ok: false, error: "Credenciales de Google no configuradas" };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.refresh_token) {
    return { ok: false, error: data.error_description ?? data.error ?? `Google devolvió ${res.status} sin refresh_token` };
  }

  const userinfoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${data.access_token}` } });
  const userinfo = (await userinfoRes.json()) as { email?: string };

  await sql`update settings set google_refresh_token = ${data.refresh_token}, google_connected_email = ${userinfo.email ?? null} where id = 1`;
  tokenCacheado = null; // el token en caché (si había) es de la conexión anterior
  return { ok: true, email: userinfo.email };
}

/**
 * Cache en memoria del proceso, con de-duplicación de llamadas concurrentes.
 * La pestaña Resultados (§3.15) dispara varias secciones en paralelo, cada
 * una con sus propias llamadas a GSC/GA4 — sin esto, un solo cliente con
 * SEO+Ads configurado llega a pedir ~9 access tokens simultáneos contra
 * Google (y ~9 conexiones extra al pooler de Supabase para leer el refresh
 * token cada vez), lo que en producción puede acercarse al timeout de la
 * función serverless. El token vive ~1h; se cachea con margen de 60s.
 */
let tokenCacheado: { accessToken: string; expiraEn: number } | null = null;
let refrescoEnCurso: Promise<string> | null = null;

async function refrescarAccessTokenGoogle(): Promise<string> {
  const [settings] = await sql<{ google_refresh_token: string | null }[]>`select google_refresh_token from settings where id = 1`;
  if (!settings?.google_refresh_token) throw new Error("Google no está conectado — falta conectar la cuenta en /ajustes");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciales de Google no configuradas");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: settings.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Google refresh ${res.status}`);
  tokenCacheado = { accessToken: data.access_token, expiraEn: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export async function obtenerAccessTokenGoogle(): Promise<string> {
  if (tokenCacheado && tokenCacheado.expiraEn > Date.now()) return tokenCacheado.accessToken;
  if (refrescoEnCurso) return refrescoEnCurso;

  refrescoEnCurso = refrescarAccessTokenGoogle().finally(() => {
    refrescoEnCurso = null;
  });
  return refrescoEnCurso;
}

export async function obtenerEstadoConexionGoogle(): Promise<{ conectado: boolean; email: string | null }> {
  const [settings] = await sql<{ google_connected_email: string | null }[]>`select google_connected_email from settings where id = 1`;
  return { conectado: !!settings?.google_connected_email, email: settings?.google_connected_email ?? null };
}
