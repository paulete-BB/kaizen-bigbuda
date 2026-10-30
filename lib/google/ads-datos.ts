import { consultarGoogleAds, type FilaGoogleAds } from "@/lib/google/ads";

/**
 * Consultas GAQL de solo lectura sobre la cuenta de Google Ads de un cliente. Los montos de la API vienen en
 * micros (1.000.000 = 1 unidad de la moneda de la cuenta): aquí ya se devuelven en unidades. La moneda es la
 * de la cuenta (`customer.currency_code`) y no se convierte.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function rango(desde: string, hasta: string): string {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) throw new Error("Rango de fechas inválido para Google Ads");
  return `segments.date BETWEEN '${desde}' AND '${hasta}'`;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const micros = (v: unknown): number => num(v) / 1_000_000;
const dig = (fila: FilaGoogleAds, clave: string): Record<string, unknown> => (fila[clave] ?? {}) as Record<string, unknown>;

export interface ResumenAds {
  moneda: string;
  costo: number;
  clics: number;
  impresiones: number;
  conversiones: number;
  valorConversiones: number;
  /** Costo por conversión (0 si no hubo conversiones). */
  cpa: number;
  ctr: number;
}

export async function obtenerResumenAds(customerId: string, desde: string, hasta: string): Promise<ResumenAds> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT customer.currency_code, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM customer WHERE ${rango(desde, hasta)}`,
  );
  const m = dig(filas[0] ?? {}, "metrics");
  const moneda = String(dig(filas[0] ?? {}, "customer").currencyCode ?? "");
  const costo = micros(m.costMicros);
  const clics = num(m.clicks);
  const impresiones = num(m.impressions);
  const conversiones = num(m.conversions);
  return {
    moneda,
    costo,
    clics,
    impresiones,
    conversiones,
    valorConversiones: num(m.conversionsValue),
    cpa: conversiones > 0 ? costo / conversiones : 0,
    ctr: impresiones > 0 ? clics / impresiones : 0,
  };
}

export interface CampanaAds {
  id: string;
  nombre: string;
  estado: string;
  costo: number;
  clics: number;
  impresiones: number;
  conversiones: number;
  cpa: number;
  /** Cuota de impresiones de búsqueda (0-1) y lo que se pierde por presupuesto y por ranking; null si la campaña no es de búsqueda. */
  cuotaImpresiones: number | null;
  perdidaPorPresupuesto: number | null;
  perdidaPorRanking: number | null;
}

const cuota = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : num(v));

export async function obtenerCampanasAds(customerId: string, desde: string, hasta: string, limite = 30): Promise<CampanaAds[]> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE ${rango(desde, hasta)} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${Math.min(limite, 200)}`,
  );
  return filas.map((f) => {
    const c = dig(f, "campaign");
    const m = dig(f, "metrics");
    const costo = micros(m.costMicros);
    const conversiones = num(m.conversions);
    return {
      id: String(c.id ?? ""),
      nombre: String(c.name ?? ""),
      estado: String(c.status ?? ""),
      costo,
      clics: num(m.clicks),
      impresiones: num(m.impressions),
      conversiones,
      cpa: conversiones > 0 ? costo / conversiones : 0,
      cuotaImpresiones: cuota(m.searchImpressionShare),
      perdidaPorPresupuesto: cuota(m.searchBudgetLostImpressionShare),
      perdidaPorRanking: cuota(m.searchRankLostImpressionShare),
    };
  });
}

export interface PuntoDiarioAds {
  fecha: string;
  costo: number;
  clics: number;
  impresiones: number;
  conversiones: number;
}

export async function obtenerSerieDiariaAds(customerId: string, desde: string, hasta: string): Promise<PuntoDiarioAds[]> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE ${rango(desde, hasta)} ORDER BY segments.date`,
  );
  return filas.map((f) => {
    const m = dig(f, "metrics");
    return { fecha: String(dig(f, "segments").date ?? ""), costo: micros(m.costMicros), clics: num(m.clicks), impresiones: num(m.impressions), conversiones: num(m.conversions) };
  });
}

export interface TerminoBusquedaAds {
  termino: string;
  campana: string;
  grupo: string;
  costo: number;
  clics: number;
  conversiones: number;
}

export async function obtenerTerminosBusquedaAds(customerId: string, desde: string, hasta: string, limite = 40): Promise<TerminoBusquedaAds[]> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT search_term_view.search_term, campaign.name, ad_group.name, metrics.cost_micros, metrics.clicks, metrics.conversions FROM search_term_view WHERE ${rango(desde, hasta)} ORDER BY metrics.cost_micros DESC LIMIT ${Math.min(limite, 200)}`,
  );
  return filas.map((f) => {
    const m = dig(f, "metrics");
    return {
      termino: String(dig(f, "searchTermView").searchTerm ?? ""),
      campana: String(dig(f, "campaign").name ?? ""),
      grupo: String(dig(f, "adGroup").name ?? ""),
      costo: micros(m.costMicros),
      clics: num(m.clicks),
      conversiones: num(m.conversions),
    };
  });
}

export interface KeywordAds {
  texto: string;
  concordancia: string;
  campana: string;
  grupo: string;
  /** Nivel de calidad 1-10; null si Google no lo calcula todavía. */
  nivelCalidad: number | null;
  costo: number;
  clics: number;
  conversiones: number;
}

export async function obtenerKeywordsAds(customerId: string, desde: string, hasta: string, limite = 40): Promise<KeywordAds[]> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, campaign.name, ad_group.name, metrics.cost_micros, metrics.clicks, metrics.conversions FROM keyword_view WHERE ${rango(desde, hasta)} AND ad_group_criterion.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${Math.min(limite, 200)}`,
  );
  return filas.map((f) => {
    const crit = dig(f, "adGroupCriterion");
    const kw = (crit.keyword ?? {}) as Record<string, unknown>;
    const m = dig(f, "metrics");
    const calidad = ((crit.qualityInfo ?? {}) as Record<string, unknown>).qualityScore;
    return {
      texto: String(kw.text ?? ""),
      concordancia: String(kw.matchType ?? ""),
      campana: String(dig(f, "campaign").name ?? ""),
      grupo: String(dig(f, "adGroup").name ?? ""),
      nivelCalidad: calidad === undefined || calidad === null ? null : num(calidad),
      costo: micros(m.costMicros),
      clics: num(m.clicks),
      conversiones: num(m.conversions),
    };
  });
}

export interface AnuncioAds {
  id: string;
  campana: string;
  grupo: string;
  estado: string;
  /** EXCELLENT / GOOD / AVERAGE / POOR (los anuncios adaptables de búsqueda); vacío si no aplica. */
  fuerza: string;
  costo: number;
  clics: number;
  impresiones: number;
  conversiones: number;
}

export async function obtenerAnunciosAds(customerId: string, desde: string, hasta: string, limite = 40): Promise<AnuncioAds[]> {
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad_strength, ad_group_ad.status, campaign.name, ad_group.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM ad_group_ad WHERE ${rango(desde, hasta)} AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${Math.min(limite, 200)}`,
  );
  return filas.map((f) => {
    const aga = dig(f, "adGroupAd");
    const m = dig(f, "metrics");
    return {
      id: String(((aga.ad ?? {}) as Record<string, unknown>).id ?? ""),
      campana: String(dig(f, "campaign").name ?? ""),
      grupo: String(dig(f, "adGroup").name ?? ""),
      estado: String(aga.status ?? ""),
      fuerza: String(aga.adStrength ?? ""),
      costo: micros(m.costMicros),
      clics: num(m.clicks),
      impresiones: num(m.impressions),
      conversiones: num(m.conversions),
    };
  });
}

export interface CambioAds {
  fecha: string;
  usuario: string;
  origen: string;
  recurso: string;
  operacion: string;
  campos: string;
}

/** Historial de cambios de la cuenta (últimos días): sirve para no deshacer ni pisar lo que ya se hizo, incluidos los cambios automáticos de Google. */
export async function obtenerCambiosRecientesAds(customerId: string, desdeFechaHora: string, limite = 80): Promise<CambioAds[]> {
  if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(desdeFechaHora)) throw new Error("Fecha inválida para el historial de cambios");
  const filas = await consultarGoogleAds(
    customerId,
    `SELECT change_event.change_date_time, change_event.user_email, change_event.client_type, change_event.change_resource_type, change_event.resource_change_operation, change_event.changed_fields FROM change_event WHERE change_event.change_date_time >= '${desdeFechaHora}' ORDER BY change_event.change_date_time DESC LIMIT ${Math.min(limite, 500)}`,
  );
  return filas.map((f) => {
    const e = dig(f, "changeEvent");
    return {
      fecha: String(e.changeDateTime ?? ""),
      usuario: String(e.userEmail ?? ""),
      origen: String(e.clientType ?? ""),
      recurso: String(e.changeResourceType ?? ""),
      operacion: String(e.resourceChangeOperation ?? ""),
      campos: typeof e.changedFields === "string" ? e.changedFields : JSON.stringify(e.changedFields ?? ""),
    };
  });
}
