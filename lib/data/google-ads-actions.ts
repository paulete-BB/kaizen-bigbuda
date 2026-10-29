"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { ErrorGoogleAds, probarConexionGoogleAds } from "@/lib/google/ads";

/** Prueba de conexión con la cuenta de Google Ads guardada en la ficha del cliente (lee solo datos básicos de la cuenta). */
export async function probarConexionAds(clientId: string): Promise<{ ok: boolean; mensaje: string }> {
  await requireUser();
  const [c] = await sql<{ google_ads_customer_id: string | null }[]>`select google_ads_customer_id from clients where id = ${clientId}`;
  if (!c?.google_ads_customer_id) return { ok: false, mensaje: "Guarda primero el ID de la cuenta de Google Ads." };
  try {
    const r = await probarConexionGoogleAds(c.google_ads_customer_id);
    return { ok: true, mensaje: `Conectado: ${r.nombre} · moneda ${r.moneda || "?"} · zona horaria ${r.zonaHoraria || "?"}.` };
  } catch (e) {
    if (e instanceof ErrorGoogleAds) return { ok: false, mensaje: e.message };
    return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo conectar con Google Ads." };
  }
}
