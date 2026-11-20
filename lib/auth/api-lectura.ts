import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * API de solo lectura para sistemas externos (ej. el sistema de Marcel manejado
 * por Claude): no hay usuario ni correo, solo una llave larga en la variable de
 * entorno `KAIZEN_LECTURA_API_KEY` que se manda como `Authorization: Bearer <llave>`.
 * Las rutas bajo `/api/lectura` solo exponen GET — ninguna escribe nada.
 * Devuelve la respuesta de error si la llave falta o no calza, o `null` si es válida.
 */
export function rechazarSinLlave(req: Request): NextResponse | null {
  const esperada = process.env.KAIZEN_LECTURA_API_KEY;
  if (!esperada) return NextResponse.json({ ok: false, error: "La API de lectura no está configurada." }, { status: 503 });
  const recibida = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Se comparan los hashes (largo fijo) para no filtrar el largo de la llave ni el punto de diferencia.
  const a = createHash("sha256").update(recibida).digest();
  const b = createHash("sha256").update(esperada).digest();
  if (!recibida || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false, error: "Llave inválida." }, { status: 401 });
  return null;
}

export const SIN_CACHE = { "Cache-Control": "no-store" };
