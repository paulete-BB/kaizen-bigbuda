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
  /** Moneda real de la cuenta de ads (`account_currency`, pedido en el mismo insights call) — no hay un default razonable entre clientes: cada cuenta de Meta se configura en la moneda que el cliente eligió al crearla (USD, CLP, u otra), nunca asumible. */
  moneda: string;
}

/**
 * "Resultado" de una campaña/cuenta de Meta. Pedido explícito del usuario
 * tras preguntar qué contaba esta función: prioriza las **conversiones
 * personalizadas marcadas en la cuenta** (`action_type` con el prefijo
 * `offsite_conversion.custom.<id>` — el evento real que Ads Manager
 * reporta como "Resultados" cuando la campaña está optimizada hacia una
 * conversión personalizada, confirmado contra la documentación de la
 * Graph API de Meta Insights) — es justo lo que el equipo está dejando
 * bien configurado cliente por cliente, no una señal genérica de
 * clics/vistas. Si en el período se dispara más de una conversión
 * personalizada distinta, se toma la de **mayor valor** (no se suman):
 * sumarlas contaría dos veces al mismo usuario si una es un evento de
 * embudo más temprano que la otra (ej. "Agregar al carrito" +
 * "Compra" para la misma persona) — la de mayor valor es la aproximación
 * más razonable al evento de fondo de embudo real sin consultar el
 * `optimization_goal` exacto de cada ad set (la agencia no siempre tiene
 * un solo conjunto de anuncios por campaña). Solo si la cuenta no tiene
 * ninguna conversión personalizada configurada (o ninguna se disparó en
 * el período) cae al criterio anterior: landing_page_view/link_click/
 * compra de píxel, o la suma de todas las acciones si ninguna de esas
 * tampoco existe — mismo comportamiento que antes para cuentas sin
 * conversiones personalizadas todavía.
 */
function contarResultados(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  const personalizadas = actions.filter((a) => a.action_type.startsWith("offsite_conversion.custom."));
  if (personalizadas.length > 0) {
    return Math.max(...personalizadas.map((a) => parseFloat(a.value) || 0));
  }
  const prioritaria = actions.find(
    (a) => a.action_type === "landing_page_view" || a.action_type === "link_click" || a.action_type === "offsite_conversion.fb_pixel_purchase",
  );
  if (prioritaria) return parseFloat(prioritaria.value) || 0;
  return actions.reduce((suma, a) => suma + (parseFloat(a.value) || 0), 0);
}

/**
 * Conversaciones de mensajería iniciadas (Messenger/WhatsApp/Instagram
 * Direct) — el "Resultado" que reporta Meta Ads Manager para campañas con
 * objetivo de mensajes. A diferencia de link_click/landing_page_view/
 * compra de píxel, esto ocurre dentro de la propia Meta y nunca genera una
 * sesión en el sitio del cliente, así que nunca puede cruzarse contra GA4
 * — ver `seccionMeta` en `lib/data/resultados.ts`, que usa este conteo tal
 * cual para las campañas de mensajes en vez de las conversiones de GA4.
 */
function contarMensajesIniciados(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  const accion = actions.find((a) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
  return accion ? parseFloat(accion.value) || 0 : 0;
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
    moneda: typeof row?.account_currency === "string" ? row.account_currency : "USD",
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

  const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,actions,account_currency";
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
  resultados: number;
  /** true si la campaña tiene conversaciones de mensajería iniciadas — su "conversión" real nunca llega al sitio (Messenger/WhatsApp/Instagram Direct), así que no se puede cruzar contra GA4. */
  esMensajes: boolean;
  mensajesIniciados: number;
}

export interface PuntoDiarioMeta {
  fecha: string;
  gasto: number;
  impresiones: number;
  clics: number;
  resultados: number;
  /** Conversaciones de mensajería iniciadas ese día, a nivel cuenta (suma de todas las campañas de mensajes) — ver `contarMensajesIniciados`. */
  mensajesIniciados: number;
}

/** Serie diaria de gasto/clics/resultados (time_increment=1, mismo query shape que el dashboard de referencia) — pestaña Resultados (§3.15), overlay de optimizaciones sobre la serie. */
export async function obtenerSerieDiariaMeta(config: ConfigMeta, since: string, until: string): Promise<PuntoDiarioMeta[]> {
  const token = resolverTokenMeta(config.metaTokenKey);
  if (!token) throw new Error(config.metaTokenKey ? `META_TOKEN_${config.metaTokenKey} no configurado` : "META_TOKEN no configurado");

  const fields = "spend,impressions,clicks,actions";
  const data = await metaFetch(`/act_${config.adAccountId}/insights`, { fields, time_range: timeRange(since, until), time_increment: "1", level: "account" }, token);
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) || 0 : 0);
  return (data.data ?? []).map((row: Record<string, unknown>) => ({
    fecha: String(row.date_start ?? ""),
    gasto: num(row.spend),
    impresiones: num(row.impressions),
    clics: num(row.clicks),
    resultados: contarResultados(row.actions as { action_type: string; value: string }[] | undefined),
    mensajesIniciados: contarMensajesIniciados(row.actions as { action_type: string; value: string }[] | undefined),
  }));
}

export async function obtenerCampanasMeta(config: ConfigMeta, since: string, until: string, limite = 20): Promise<CampanaMeta[]> {
  const token = resolverTokenMeta(config.metaTokenKey);
  if (!token) throw new Error(config.metaTokenKey ? `META_TOKEN_${config.metaTokenKey} no configurado` : "META_TOKEN no configurado");

  const fields = "campaign_name,spend,impressions,clicks,ctr,cpc,actions";
  const data = await metaFetch(
    `/act_${config.adAccountId}/insights`,
    { fields, time_range: timeRange(since, until), level: "campaign", sort: "spend_descending", limit: String(limite) },
    token,
  );
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) || 0 : 0);
  return (data.data ?? []).map((row: Record<string, unknown>) => {
    const actions = row.actions as { action_type: string; value: string }[] | undefined;
    const mensajesIniciados = contarMensajesIniciados(actions);
    return {
      nombre: String(row.campaign_name ?? ""),
      gasto: num(row.spend),
      impresiones: num(row.impressions),
      clics: num(row.clicks),
      ctr: num(row.ctr),
      cpc: num(row.cpc),
      resultados: contarResultados(actions),
      esMensajes: mensajesIniciados > 0,
      mensajesIniciados,
    };
  });
}
