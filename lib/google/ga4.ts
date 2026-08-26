import { obtenerAccessTokenGoogle } from "@/lib/google/oauth";

const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

/**
 * Dominios de fuentes de IA usados para clasificar tráfico (§3.14/§4.3
 * "limitaciones conocidas"). El dashboard de referencia agrupaba
 * `google.com`/`bard.google.com` bajo "Google AI Overview" — se dejó
 * afuera acá a propósito: `sessionSource` CONTAINS "google.com" también
 * matchea casi todo el tráfico orgánico normal de Google, no solo AI
 * Overview (que de hecho no es filtrable por separado en la API de GSC/GA4
 * — brief §3.14). Mejor subestimar el tráfico de IA que inflarlo con
 * búsqueda orgánica común.
 */
export const DOMINIOS_IA = ["chatgpt.com", "chat.openai.com", "perplexity.ai", "gemini.google.com", "claude.ai", "copilot.microsoft.com"];

interface Ga4Row {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

async function consultarGA4(propertyId: string, body: Record<string, unknown>): Promise<{ rows?: Ga4Row[] }> {
  const accessToken = await obtenerAccessTokenGoogle();
  const res = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GA4 API ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

const num = (v: string | undefined) => Number(v ?? 0);

/** GA4 devuelve la dimensión `date` como YYYYMMDD sin separadores — se normaliza a ISO para poder cruzarla con las fechas de la app. */
function fechaGa4AIso(v: string): string {
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

export interface ResumenGA4Organico {
  sesiones: number;
  conversiones: number;
}

/** Tráfico orgánico (sessionDefaultChannelGroup = "Organic Search") — impacto de negocio del SEO, distinto del tráfico total del sitio. */
export async function obtenerTraficoOrganicoGA4(propertyId: string, startDate: string, endDate: string): Promise<ResumenGA4Organico> {
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
  });
  const row = data.rows?.[0];
  return { sesiones: num(row?.metricValues?.[0]?.value), conversiones: num(row?.metricValues?.[1]?.value) };
}

export interface PuntoDiarioOrganico {
  fecha: string;
  sesiones: number;
  conversiones: number;
}

/** Serie diaria de conversiones orgánicas — pestaña Resultados (§3.15), para comparar clics (GSC) vs. conversiones (GA4) en el mismo gráfico. */
export async function obtenerTraficoOrganicoDiarioGA4(propertyId: string, startDate: string, endDate: string): Promise<PuntoDiarioOrganico[]> {
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return (data.rows ?? []).map((r) => ({
    fecha: fechaGa4AIso(r.dimensionValues?.[0]?.value ?? ""),
    sesiones: num(r.metricValues?.[0]?.value),
    conversiones: num(r.metricValues?.[1]?.value),
  }));
}

export interface FilaTraficoIA {
  fuente: string;
  sesiones: number;
  usuarios: number;
  conversiones: number;
}

export interface ResumenTraficoIA {
  totalSesiones: number;
  filas: FilaTraficoIA[];
}

/** Tráfico desde fuentes de IA (§3.14/§3.15, GEO·IA) — sessionSource CONTAINS alguno de los dominios conocidos. */
export async function obtenerTraficoIAGA4(propertyId: string, startDate: string, endDate: string): Promise<ResumenTraficoIA> {
  const domainFilter = {
    orGroup: {
      expressions: DOMINIOS_IA.map((d) => ({
        filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS" as const, value: d, caseSensitive: false } },
      })),
    },
  };
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
    dimensionFilter: domainFilter,
    limit: 200,
  });
  const filas = (data.rows ?? []).map((r) => ({
    fuente: r.dimensionValues?.[0]?.value ?? "",
    sesiones: num(r.metricValues?.[0]?.value),
    usuarios: num(r.metricValues?.[1]?.value),
    conversiones: num(r.metricValues?.[2]?.value),
  }));
  return { totalSesiones: filas.reduce((s, f) => s + f.sesiones, 0), filas };
}

export interface ResumenTraficoPagado {
  sesiones: number;
  conversiones: number;
  costo: number;
}

function filtroTraficoPagado() {
  return {
    orGroup: {
      expressions: [
        { filter: { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT" as const, value: "cpc", caseSensitive: false } } },
        { filter: { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT" as const, value: "paid", caseSensitive: false } } },
      ],
    },
  };
}

/** Google Ads vía GA4 (sessionMedium = cpc | paid) — usado para el informe de Google Ads, que no tiene una API de Ads propia conectada todavía. */
export async function obtenerTraficoPagadoGA4(propertyId: string, startDate: string, endDate: string): Promise<ResumenTraficoPagado> {
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "advertiserAdCost" }],
    dimensionFilter: filtroTraficoPagado(),
  });
  const row = data.rows?.[0];
  return { sesiones: num(row?.metricValues?.[0]?.value), conversiones: num(row?.metricValues?.[1]?.value), costo: num(row?.metricValues?.[2]?.value) };
}

export interface CampanaPagadoGA4 {
  nombre: string;
  sesiones: number;
  conversiones: number;
  costo: number;
}

/** Desglose por campaña del tráfico pagado (Google Ads vía GA4) — misma lógica de "impacto en el negocio" que el informe: no solo gasto, sino qué campaña convierte. */
export async function obtenerCampanasPagadoGA4(propertyId: string, startDate: string, endDate: string, limit = 10): Promise<CampanaPagadoGA4[]> {
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionCampaignName" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "advertiserAdCost" }],
    dimensionFilter: filtroTraficoPagado(),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });
  return (data.rows ?? []).map((r) => ({
    nombre: r.dimensionValues?.[0]?.value || "(sin nombre)",
    sesiones: num(r.metricValues?.[0]?.value),
    conversiones: num(r.metricValues?.[1]?.value),
    costo: num(r.metricValues?.[2]?.value),
  }));
}

export interface PaginaDestinoIA {
  pagina: string;
  sesiones: number;
  conversiones: number;
}

/** Páginas de aterrizaje del tráfico desde IA — responde "¿a qué página está llegando la gente que la IA recomienda?", no solo cuánta gente llega. */
export async function obtenerPaginasDestinoIAGA4(propertyId: string, startDate: string, endDate: string, limit = 10): Promise<PaginaDestinoIA[]> {
  const domainFilter = {
    orGroup: {
      expressions: DOMINIOS_IA.map((d) => ({
        filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS" as const, value: d, caseSensitive: false } },
      })),
    },
  };
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    dimensionFilter: domainFilter,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });
  return (data.rows ?? []).map((r) => ({
    pagina: r.dimensionValues?.[0]?.value || "/",
    sesiones: num(r.metricValues?.[0]?.value),
    conversiones: num(r.metricValues?.[1]?.value),
  }));
}

export interface PuntoDiarioPagado {
  fecha: string;
  sesiones: number;
  conversiones: number;
  costo: number;
}

/** Serie diaria de tráfico pagado (Google Ads vía GA4) — pestaña Resultados (§3.15), overlay de optimizaciones sobre la serie. */
export async function obtenerTraficoPagadoDiarioGA4(propertyId: string, startDate: string, endDate: string): Promise<PuntoDiarioPagado[]> {
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "advertiserAdCost" }],
    dimensionFilter: filtroTraficoPagado(),
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return (data.rows ?? []).map((r) => ({
    fecha: fechaGa4AIso(r.dimensionValues?.[0]?.value ?? ""),
    sesiones: num(r.metricValues?.[0]?.value),
    conversiones: num(r.metricValues?.[1]?.value),
    costo: num(r.metricValues?.[2]?.value),
  }));
}
