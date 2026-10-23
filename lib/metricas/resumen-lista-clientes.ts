import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, toIso } from "@/lib/dates";
import { conCacheDeSnapshot } from "./snapshot";
import { obtenerResumenGSC, type ResumenGSC } from "@/lib/google/gsc";
import { obtenerTraficoIAGA4, obtenerConversionesPaidSocialDiarioGA4, type ResumenTraficoIA } from "@/lib/google/ga4";

const LOTE = 50;

/**
 * Search Console tarda 2-3 días en procesar datos (mismo motivo que
 * `desplazarParaGsc` en `lib/data/resultados.ts` — no se comparte esa
 * constante entre módulos, convención ya establecida en el proyecto).
 */
const GSC_LATENCIA_DIAS = 3;

export interface ResultadoSnapshotResumenLista {
  evaluados: number;
  guardados: number;
}

/**
 * Corrido por el cron de Vercel una vez al día (`snapshot-resumen-clientes`):
 * guarda, para cada servicio activo con la integración configurada, un
 * snapshot de UN SOLO DÍA — pedido explícito del usuario para la lista de
 * `/clientes`: en vez de comparar dos ventanas (hoy vs. hace 7 días) para
 * detectar si "bajó", simplemente se imprime el número del día más reciente
 * disponible. La lista de clientes solo LEE estos snapshots, nunca llama a
 * GSC/GA4 en vivo (mismo criterio ya establecido tras el bug de fan-out de
 * Resultados/Gonfernic).
 *
 * Google Ads no necesita nada nuevo acá: el cron `snapshot-conversiones-ayer`
 * ya guarda exactamente este mismo shape (`ResumenTraficoPagado`, fuente
 * `ga4`, período de un día) para ese servicio — la lista de clientes lee ese
 * snapshot existente directo.
 */
export async function snapshotResumenListaClientes(): Promise<ResultadoSnapshotResumenLista> {
  const ayer = addDaysIso(toIso(hoySantiago()), -1);
  const diaGsc = addDaysIso(toIso(hoySantiago()), -GSC_LATENCIA_DIAS);

  const servicios = await sql<
    {
      service_id: string;
      client_id: string;
      tipo: "seo_aeo_geo" | "meta_ads" | "google_ads";
      gsc_property: string | null;
      ga4_property_id: string | null;
      meta_ads_ga4_property_id: string | null;
    }[]
  >`
    select s.id as service_id, s.client_id, s.tipo, c.gsc_property, c.ga4_property_id, c.meta_ads_ga4_property_id
    from services s join clients c on c.id = s.client_id
    where s.tipo in ('seo_aeo_geo', 'meta_ads') and not s.pausado
    limit ${LOTE}
  `;

  let guardados = 0;
  for (const s of servicios) {
    try {
      if (s.tipo === "seo_aeo_geo") {
        if (s.gsc_property) {
          await conCacheDeSnapshot<ResumenGSC>({
            clientId: s.client_id,
            serviceId: s.service_id,
            fuente: "gsc",
            periodoInicio: diaGsc,
            periodoFin: diaGsc,
            fetchLive: () => obtenerResumenGSC(s.gsc_property!, diaGsc, diaGsc),
          });
          guardados++;
        }
        if (s.ga4_property_id) {
          await conCacheDeSnapshot<ResumenTraficoIA>({
            clientId: s.client_id,
            serviceId: s.service_id,
            fuente: "ga4",
            periodoInicio: ayer,
            periodoFin: ayer,
            fetchLive: () => obtenerTraficoIAGA4(s.ga4_property_id!, ayer, ayer),
          });
          guardados++;
        }
      } else if (s.tipo === "meta_ads") {
        // Pedido explícito del usuario: para Meta Ads en esta lista, la
        // conversión que importa es la real del sitio (GA4, Paid Social) de
        // ayer — mismo criterio ya usado en la tabla de campañas de
        // Resultados, no el conteo propio de Meta (`contarResultados`).
        // Campañas de mensajería (Messenger/WhatsApp) no generan sesión en
        // el sitio, así que quedan en 0 acá — mismo límite ya documentado en
        // Resultados, aceptado a propósito para mantener esto simple.
        // `meta_ads_ga4_property_id` con fallback a `ga4_property_id`,
        // mismo criterio que `seccionMeta` en lib/data/resultados.ts (bug
        // real: Fiavelle manda Meta Ads a una landing propia, sin este
        // fallback nunca se intentaba la llamada para ese caso).
        const ga4ParaMeta = s.meta_ads_ga4_property_id ?? s.ga4_property_id;
        if (ga4ParaMeta) {
          // El fetch real va DENTRO de `fetchLive`: si la llamada a GA4 falla,
          // tiene que propagar la excepción para que `conCacheDeSnapshot`
          // caiga al último snapshot cacheado — envolverlo en un .catch acá
          // afuera guardaría un falso "0 en vivo" en vez de degradar como
          // corresponde.
          await conCacheDeSnapshot<{ conversiones: number }>({
            clientId: s.client_id,
            serviceId: s.service_id,
            fuente: "ga4",
            periodoInicio: ayer,
            periodoFin: ayer,
            fetchLive: async () => {
              const [punto] = await obtenerConversionesPaidSocialDiarioGA4(ga4ParaMeta, ayer, ayer);
              return { conversiones: punto?.conversiones ?? 0 };
            },
          });
          guardados++;
        }
      }
    } catch {
      // un servicio que falla (API caída, config incompleta, etc.) no debe frenar el resto del lote
    }
  }

  return { evaluados: servicios.length, guardados };
}
