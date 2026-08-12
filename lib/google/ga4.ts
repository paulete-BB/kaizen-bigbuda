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
const DOMINIOS_IA = ["chatgpt.com", "chat.openai.com", "perplexity.ai", "gemini.google.com", "claude.ai", "copilot.microsoft.com"];

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

/** Google Ads vía GA4 (sessionMedium = cpc | paid) — usado para el informe de Google Ads, que no tiene una API de Ads propia conectada todavía. */
export async function obtenerTraficoPagadoGA4(propertyId: string, startDate: string, endDate: string): Promise<ResumenTraficoPagado> {
  const paidFilter = {
    orGroup: {
      expressions: [
        { filter: { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT" as const, value: "cpc", caseSensitive: false } } },
        { filter: { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT" as const, value: "paid", caseSensitive: false } } },
      ],
    },
  };
  const data = await consultarGA4(propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "advertiserAdCost" }],
    dimensionFilter: paidFilter,
  });
  const row = data.rows?.[0];
  return { sesiones: num(row?.metricValues?.[0]?.value), conversiones: num(row?.metricValues?.[1]?.value), costo: num(row?.metricValues?.[2]?.value) };
}
