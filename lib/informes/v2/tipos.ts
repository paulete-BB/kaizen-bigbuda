/**
 * Informe mensual "v2" (`reports.contenido_json.version === 2`): sin plantilla
 * de texto libre. Guarda una **foto de los mismos datos que muestra la pestaña
 * Resultados** (gráficos, KPIs, keywords, campañas) tomada al momento de
 * emitirlo, más lo poco que escribe una persona: los insights (3 frases por
 * servicio, pensadas para sacarse con Claude), lo que se hizo y lo que viene.
 * Los informes anteriores (sin `version`) siguen con su formato y editores.
 */
import type { SeccionAeo, SeccionGoogleAds, SeccionMeta, SeccionSeo } from "@/lib/data/resultados";

export type SeccionInsight = "seo" | "meta" | "googleAds";

/** Largo objetivo de cada insight (el pedido original: ~150 caracteres). */
export const LARGO_INSIGHT_OBJETIVO = 150;
/** Pasado este largo el editor avisa que probablemente no cabe en la tarjeta del informe. */
export const LARGO_INSIGHT_MAX = 190;
export const INSIGHTS_POR_SECCION = 3;
export const AGENDA_URL_POR_DEFECTO = "calendly.com/paulete-bigbuda/30min";

export interface PeriodoV2 {
  /** Ventana actual (28 días) y la inmediatamente anterior, con sus fechas ISO. */
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
  /** Día en que se emitió el informe (foto de los datos). */
  emitidoEn: string;
}

/** Secciones de Resultados sin los hitos (solo sirven para el overlay de la pestaña). */
export interface DatosV2 {
  seo?: SeccionSeo;
  aeo?: SeccionAeo;
  meta?: SeccionMeta;
  googleAds?: SeccionGoogleAds;
}

export interface InformeV2Contenido {
  version: 2;
  periodo: PeriodoV2;
  datos: DatosV2;
  insights: Record<SeccionInsight, string[]>;
  /** "Lo que hicimos": una línea por acción, prellenada desde la bitácora del período. */
  hechos: string[];
  /** "Lo que viene": próximos pasos (máx. 5). */
  proximos: string[];
  agendaUrl: string;
}

export function esInformeV2(contenido: unknown): contenido is InformeV2Contenido {
  return typeof contenido === "object" && contenido !== null && (contenido as { version?: unknown }).version === 2;
}

export function insightsVacios(): Record<SeccionInsight, string[]> {
  return { seo: [], meta: [], googleAds: [] };
}
