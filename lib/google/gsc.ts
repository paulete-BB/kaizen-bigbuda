import { obtenerAccessTokenGoogle } from "@/lib/google/oauth";

const GSC_API = "https://www.googleapis.com/webmasters/v3";

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function consultarGSC(propertyUrl: string, body: Record<string, unknown>): Promise<{ rows?: GscRow[] }> {
  const accessToken = await obtenerAccessTokenGoogle();
  const res = await fetch(`${GSC_API}/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GSC API ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export interface ResumenGSC {
  clics: number;
  impresiones: number;
  ctr: number;
  posicionMedia: number;
}

export async function obtenerResumenGSC(propertyUrl: string, startDate: string, endDate: string): Promise<ResumenGSC> {
  const data = await consultarGSC(propertyUrl, { startDate, endDate, rowLimit: 1 });
  const row = data.rows?.[0];
  return { clics: row?.clicks ?? 0, impresiones: row?.impressions ?? 0, ctr: row?.ctr ?? 0, posicionMedia: row?.position ?? 0 };
}

export interface KeywordGSC {
  query: string;
  clics: number;
  impresiones: number;
  ctr: number;
  posicion: number;
}

export async function obtenerKeywordsGSC(propertyUrl: string, startDate: string, endDate: string, rowLimit = 25): Promise<KeywordGSC[]> {
  const data = await consultarGSC(propertyUrl, { startDate, endDate, dimensions: ["query"], rowLimit });
  return (data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    clics: r.clicks,
    impresiones: r.impressions,
    ctr: r.ctr,
    posicion: r.position,
  }));
}

export interface PuntoDiarioGSC {
  fecha: string;
  clics: number;
  impresiones: number;
  ctr: number;
  posicion: number;
}

export async function obtenerSerieDiariaGSC(propertyUrl: string, startDate: string, endDate: string): Promise<PuntoDiarioGSC[]> {
  const data = await consultarGSC(propertyUrl, { startDate, endDate, dimensions: ["date"], rowLimit: 100 });
  return (data.rows ?? []).map((r) => ({
    fecha: r.keys?.[0] ?? "",
    clics: r.clicks,
    impresiones: r.impressions,
    ctr: r.ctr,
    posicion: r.position,
  }));
}

/** Solo para el selector de propiedades al configurar un cliente — lista los sitios verificados a los que la cuenta conectada tiene acceso. */
export async function listarPropiedadesGSC(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const accessToken = await obtenerAccessTokenGoogle();
  const res = await fetch(`${GSC_API}/sites`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GSC API ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
  return data.siteEntry ?? [];
}
