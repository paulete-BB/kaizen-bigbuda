import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sesión propia (email + password + cookie firmada) mientras no hay un
 * proyecto Supabase real con Auth (GoTrue) conectado — ver .env.example.
 * El runtime de `proxy.ts` en Next 16 es siempre "nodejs", así que el
 * módulo `crypto` está disponible tanto ahí como en Server Actions.
 */

export const SESSION_COOKIE = "kb_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface SessionPayload {
  userId: string;
  rol: "admin" | "miembro";
  nombre: string;
  exp: number;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET no está configurado");
  return value;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
