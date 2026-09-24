import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, toIso } from "@/lib/dates";
import { conCacheDeSnapshot } from "./snapshot";
import { obtenerResumenMeta, type ResumenInsightsMeta } from "@/lib/meta/client";
import { obtenerTraficoPagadoGA4, type ResumenTraficoPagado } from "@/lib/google/ga4";

const LOTE = 50;

export interface ResultadoSnapshotConversionesAyer {
  evaluados: number;
  guardados: number;
}

/**
 * Corrido por el cron de Vercel una vez al día (`app/api/cron/snapshot-conversiones-ayer`):
 * guarda, para cada servicio de Ads activo con su config cargada, un
 * snapshot de conversiones de "ayer" (`periodo_inicio = periodo_fin`, un
 * único día) — combinación de período que ningún otro llamador usa hoy
 * (todos piden rangos de 14/28/90 días o mes calendario), así que no
 * colisiona con los snapshots agregados ya existentes bajo la misma clave
 * (cliente, servicio, fuente, período).
 *
 * Es la única llamada en vivo de la alerta "sin conversiones ayer" — el
 * dashboard (`lib/data/dashboard.ts`) solo LEE estos snapshots, nunca
 * llama a Meta/GA4 directamente (mismo criterio ya establecido tras el bug
 * de fan-out de Resultados/Gonfernic).
 */
export async function snapshotConversionesAyer(): Promise<ResultadoSnapshotConversionesAyer> {
  const ayer = addDaysIso(toIso(hoySantiago()), -1);

  const servicios = await sql<
    {
      service_id: string;
      client_id: string;
      tipo: "meta_ads" | "google_ads";
      meta_ad_account_id: string | null;
      meta_token_key: string | null;
      google_ads_ga4_property_id: string | null;
    }[]
  >`
    select s.id as service_id, s.client_id, s.tipo,
      c.meta_ad_account_id, c.meta_token_key, c.google_ads_ga4_property_id
    from services s join clients c on c.id = s.client_id
    where s.tipo in ('meta_ads', 'google_ads') and not s.pausado
    limit ${LOTE}
  `;

  let guardados = 0;
  for (const s of servicios) {
    try {
      if (s.tipo === "meta_ads") {
        if (!s.meta_ad_account_id) continue;
        await conCacheDeSnapshot<ResumenInsightsMeta>({
          clientId: s.client_id,
          serviceId: s.service_id,
          fuente: "meta",
          periodoInicio: ayer,
          periodoFin: ayer,
          fetchLive: () => obtenerResumenMeta({ adAccountId: s.meta_ad_account_id!, metaTokenKey: s.meta_token_key }, ayer, ayer),
        });
      } else {
        if (!s.google_ads_ga4_property_id) continue;
        await conCacheDeSnapshot<ResumenTraficoPagado>({
          clientId: s.client_id,
          serviceId: s.service_id,
          fuente: "ga4",
          periodoInicio: ayer,
          periodoFin: ayer,
          fetchLive: () => obtenerTraficoPagadoGA4(s.google_ads_ga4_property_id!, ayer, ayer),
        });
      }
      guardados++;
    } catch {
      // un cliente que falla (API caída, config incompleta, etc.) no debe frenar el resto del lote
    }
  }

  return { evaluados: servicios.length, guardados };
}
