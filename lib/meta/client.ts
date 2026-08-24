const META_API = "https://graph.facebook.com/v19.0";

/**
 * El dashboard de referencia llamaba a esto vía un Cloudflare Worker (CORS
 * proxy, necesario solo porque corría en el navegador). Server-side no
 * hace falta el proxy — se llama directo a la Graph API con el mismo
 * token, mismos endpoints y mismos campos ya probados en producción.
 */
function resolverTokenMeta(metaTokenKey: string | null): string | null {
  if (metaTokenKey) {
    return process.env[`META_TOKEN_${metaTokenKey}`] ?? null;
  }
  return process.env.META_TOKEN ?? null;
}

async function metaFetch(endpoint: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${META_API}${endpoint}?${qs}`, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `Meta API ${res.status}`);
  return data;
}

function timeRange(since: string, until: string) {
  return JSON.stringify({ since, until });
}

export interface ResumenInsightsMeta {
  gasto: number;
  impresiones: number;
  clics: number;
  ctr: number;
  cpc: number;
  cpm: number;
  alcance: number;
  resultados: number;
}

/** Mismo criterio de "resultado" que usaba el dashboard: prioriza vistas de landing/clics/compras del píxel antes de sumar todas las acciones a ciegas. */
function contarResultados(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  const prioritaria = actions.find(
    (a) => a.action_type === "landing_page_view" || a.action_type === "link_click" || a.action_type === "offsite_conversion.fb_pixel_purchase",
  );
  if (prioritaria) return parseFloat(prioritaria.value) || 0;
  return actions.reduce((suma, a) => suma + (parseFloat(a.value) || 0), 0);
}

function parseResumen(row: Record<string, unknown> | undefined): ResumenInsightsMeta {
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) || 0 : 0);
  return {
    gasto: num(row?.spend),
    impresiones: num(row?.impressions),
    clics: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    cpm: num(row?.cpm),
    alcance: num(row?.reach),
    resultados: contarResultados(row?.actions as { action_type: string; value: string }[] | undefined),
  };
}

export interface ConfigMeta {
  adAccountId: string;
  metaTokenKey: string | null;
}

/** Resumen de cuenta para un período — usado en el pre-llenado de "¿Cómo vamos?" del informe de Ads y en la pestaña Resultados (§3.15). */
export async function obtenerResumenMeta(config: ConfigMeta, since: string, until: string): Promise<ResumenInsightsMeta> {
  const token = resolverTokenMeta(config.metaTokenKey);
  if (!token) throw new Error(config.metaTokenKey ? `META_TOKEN_${config.metaTokenKey} no configurado` : "META_TOKEN no configurado");

  const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,actions";
  const data = await metaFetch(`/act_${config.adAccountId}/insights`, { fields, time_range: timeRange(since, until), level: "account" }, token);
  return parseResumen(data.data?.[0]);
}

export interface CampanaMeta {
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  ctr: number;
  cpc: number;
}

export interface PuntoDiarioMeta {
  fecha: string;
  gasto: number;
  impresiones: number;
  clics: number;
}

/** Serie diaria de gasto/clics (time_increment=1, mismo query shape que el dashboard de referencia) — pestaña Resultados (§3.15), overlay de optimizaciones sobre la serie. */
export async function obtenerSerieDiariaMeta(config: ConfigMeta, since: string, until: string): Promise<PuntoDiarioMeta[]> {
  const token = resolverTokenMeta(config.metaTokenKey);
  if (!token) throw new Error(config.metaTokenKey ? `META_TOKEN_${config.metaTokenKey} no configurado` : "META_TOKEN no configurado");

  const fields = "spend,impressions,clicks";
  const data = await metaFetch(`/act_${config.adAccountId}/insights`, { fields, time_range: timeRange(since, until), time_increment: "1", level: "account" }, token);
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) || 0 : 0);
  return (data.data ?? []).map((row: Record<string, unknown>) => ({
    fecha: String(row.date_start ?? ""),
    gasto: num(row.spend),
    impresiones: num(row.impressions),
    clics: num(row.clicks),
  }));
}

export async function obtenerCampanasMeta(config: ConfigMeta, since: string, until: string, limite = 20): Promise<CampanaMeta[]> {
  const token = resolverTokenMeta(config.metaTokenKey);
  if (!token) throw new Error(config.metaTokenKey ? `META_TOKEN_${config.metaTokenKey} no configurado` : "META_TOKEN no configurado");

  const fields = "campaign_name,spend,impressions,clicks,ctr,cpc";
  const data = await metaFetch(
    `/act_${config.adAccountId}/insights`,
    { fields, time_range: timeRange(since, until), level: "campaign", sort: "spend_descending", limit: String(limite) },
    token,
  );
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) || 0 : 0);
  return (data.data ?? []).map((row: Record<string, unknown>) => ({
    nombre: String(row.campaign_name ?? ""),
    gasto: num(row.spend),
    impresiones: num(row.impressions),
    clics: num(row.clicks),
    ctr: num(row.ctr),
    cpc: num(row.cpc),
  }));
}
