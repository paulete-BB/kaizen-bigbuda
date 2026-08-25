import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, toIso } from "@/lib/dates";
import { conCacheDeSnapshot } from "@/lib/metricas/snapshot";
import { obtenerKeywordsGSC, obtenerResumenGSC, obtenerSerieDiariaGSC, type ResumenGSC } from "@/lib/google/gsc";
import {
  DOMINIOS_IA,
  obtenerTraficoIAGA4,
  obtenerTraficoPagadoDiarioGA4,
  obtenerTraficoPagadoGA4,
  type ResumenTraficoIA,
  type ResumenTraficoPagado,
} from "@/lib/google/ga4";
import { obtenerCampanasMeta, obtenerResumenMeta, obtenerSerieDiariaMeta, type ResumenInsightsMeta } from "@/lib/meta/client";
import type { ServicioTipo } from "@/lib/data/cliente-detalle";
import { RANGOS_RESULTADOS, type RangoResultados } from "@/lib/resultados-rango";

export { RANGOS_RESULTADOS, type RangoResultados };

export interface ClienteSelectorResultados {
  id: string;
  nombre: string;
  serviciosTipos: ServicioTipo[];
  tieneGsc: boolean;
  tieneGa4: boolean;
  tieneMeta: boolean;
}

/** Lista liviana para el selector de cliente de la pestaña Resultados — solo lo necesario para poblar el <select> y decidir qué secciones mostrar. */
export async function listarClientesParaResultados(): Promise<ClienteSelectorResultados[]> {
  const rows = await sql<
    {
      id: string;
      nombre: string;
      gsc_property: string | null;
      ga4_property_id: string | null;
      meta_ad_account_id: string | null;
      tipo: ServicioTipo | null;
    }[]
  >`
    select c.id, c.nombre, c.gsc_property, c.ga4_property_id, c.meta_ad_account_id, s.tipo
    from clients c
    left join services s on s.client_id = c.id and not s.pausado
    where c.estado != 'finalizado'
    order by c.nombre
  `;
  const porCliente = new Map<string, ClienteSelectorResultados>();
  for (const r of rows) {
    if (!porCliente.has(r.id)) {
      porCliente.set(r.id, {
        id: r.id,
        nombre: r.nombre,
        serviciosTipos: [],
        tieneGsc: !!r.gsc_property,
        tieneGa4: !!r.ga4_property_id,
        tieneMeta: !!r.meta_ad_account_id,
      });
    }
    if (r.tipo) porCliente.get(r.id)!.serviciosTipos.push(r.tipo);
  }
  return [...porCliente.values()];
}

export interface RangoFechas {
  desde: string;
  hasta: string;
}

function calcularRangos(rango: RangoResultados): { actual: RangoFechas; anterior: RangoFechas } {
  const hasta = toIso(hoySantiago());
  const desde = addDaysIso(hasta, -(rango - 1));
  const hastaAnterior = addDaysIso(desde, -1);
  const desdeAnterior = addDaysIso(hastaAnterior, -(rango - 1));
  return { actual: { desde, hasta }, anterior: { desde: desdeAnterior, hasta: hastaAnterior } };
}

export interface Hito {
  fecha: string;
  tipo: "optimizacion" | "informe";
  etiqueta: string;
}

/**
 * Trae los hitos de las tres líneas de servicio en 2 queries (no 2 por
 * sección) y los agrupa por tipo — con un cliente configurado en las tres
 * líneas, cada sección corriendo su propia consulta sumaba conexiones
 * concurrentes de sobra contra el pooler de Supabase (§3.15, visto en
 * producción con un cliente con SEO+Ads: la página se caía).
 */
async function obtenerTodosLosHitos(clientId: string, desde: string, hasta: string): Promise<Record<ServicioTipo, Hito[]>> {
  const [optimizaciones, informes] = await Promise.all([
    sql<{ tipo: ServicioTipo; fecha_realizada: string }[]>`
      select tipo, fecha_realizada from optimizations
      where client_id = ${clientId} and estado = 'realizada'
        and fecha_realizada between ${desde} and ${hasta}
    `,
    sql<{ tipo: ServicioTipo; fecha: string }[]>`
      select tipo, enviado_en::date as fecha from reports
      where client_id = ${clientId} and estado = 'enviado'
        and enviado_en::date between ${desde} and ${hasta}
    `,
  ]);
  const porTipo: Record<ServicioTipo, Hito[]> = { seo_aeo_geo: [], meta_ads: [], google_ads: [] };
  for (const o of optimizaciones) porTipo[o.tipo].push({ fecha: o.fecha_realizada, tipo: "optimizacion", etiqueta: "Optimización realizada" });
  for (const r of informes) porTipo[r.tipo].push({ fecha: r.fecha, tipo: "informe", etiqueta: "Informe enviado" });
  return porTipo;
}

export interface Delta {
  /** % de cambio real (sin invertir) — la flecha del KPI apunta según su signo literal. */
  pct: number | null;
  tendencia: "up" | "down" | "flat";
  /** Si este movimiento es una buena noticia — separado de `tendencia` porque en CPC/costo/posición media bajar es mejorar (el número y la flecha siguen siendo literales; solo el color cambia). */
  favorable: boolean;
}

/** `invertido` es para métricas donde bajar es la mejora (CPC, costo, posición media): no cambia el número ni la flecha, solo si cuenta como `favorable`. */
function delta(actual: number, anterior: number, invertido = false): Delta {
  if (!anterior) return { pct: null, tendencia: actual > 0 ? "up" : "flat", favorable: actual > 0 !== invertido };
  const pct = Math.round((((actual - anterior) / Math.abs(anterior)) * 100) * 10) / 10;
  const tendencia = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  const favorable = tendencia === "flat" ? true : invertido ? tendencia === "down" : tendencia === "up";
  return { pct, tendencia, favorable };
}

export interface KpiResultado {
  etiqueta: string;
  valor: string;
  delta: Delta | null;
}

export interface PuntoSerie {
  fecha: string;
  valor: number;
}

export interface SeccionSeo {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  kpis: KpiResultado[];
  serie: PuntoSerie[];
  hitos: Hito[];
  keywords: { termino: string; clics: number; impresiones: number; ctr: number; posicion: number }[];
}

export interface SeccionAeo {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  totalSesiones: number;
  deltaSesiones: Delta | null;
  porFuente: { fuente: string; sesiones: number }[];
}

export interface SeccionMeta {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  kpis: KpiResultado[];
  serie: PuntoSerie[];
  hitos: Hito[];
  campanas: { nombre: string; gasto: number }[];
}

export interface SeccionGoogleAds {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  kpis: KpiResultado[];
  serie: PuntoSerie[];
  hitos: Hito[];
}

export interface ResultadosCliente {
  clienteId: string;
  clienteNombre: string;
  rango: RangoResultados;
  rangoFechas: RangoFechas;
  seo: SeccionSeo;
  aeo: SeccionAeo;
  meta: SeccionMeta;
  googleAds: SeccionGoogleAds;
}

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const fmtMoneda = (n: number, moneda = "USD") => `${Math.round(n).toLocaleString("es-CL")} ${moneda}`;

/** Las APIs a veces omiten días sin actividad — se completa el rango con 0 para que el eje X del gráfico sea un calendario continuo (necesario para que los hitos se ubiquen en la posición correcta). */
function rellenarDias(desde: string, hasta: string, puntos: { fecha: string; valor: number }[]): PuntoSerie[] {
  const porFecha = new Map(puntos.map((p) => [p.fecha, p.valor]));
  const resultado: PuntoSerie[] = [];
  let cursor = desde;
  while (cursor <= hasta) {
    resultado.push({ fecha: cursor, valor: porFecha.get(cursor) ?? 0 });
    cursor = addDaysIso(cursor, 1);
  }
  return resultado;
}

async function seccionSeo(
  clientId: string,
  serviceId: string | null,
  gscProperty: string | null,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
  hitos: Hito[],
): Promise<SeccionSeo> {
  if (!gscProperty) {
    return { disponible: false, motivo: "Configura la propiedad de Search Console en la ficha del cliente.", kpis: [], serie: [], hitos: [], keywords: [] };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria, keywordsTop] = await Promise.all([
      conCacheDeSnapshot<ResumenGSC>({ clientId, serviceId, fuente: "gsc", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerResumenGSC(gscProperty, desde, hasta) }),
      conCacheDeSnapshot<ResumenGSC>({ clientId, serviceId, fuente: "gsc", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerResumenGSC(gscProperty, desdeAnt, hastaAnt) }),
      obtenerSerieDiariaGSC(gscProperty, desde, hasta),
      obtenerKeywordsGSC(gscProperty, desde, hasta, 10),
    ]);
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      kpis: [
        { etiqueta: "Clics", valor: fmtNumero(actual.clics), delta: delta(actual.clics, anterior.clics) },
        { etiqueta: "Impresiones", valor: fmtNumero(actual.impresiones), delta: delta(actual.impresiones, anterior.impresiones) },
        { etiqueta: "CTR", valor: fmtPct(actual.ctr), delta: delta(actual.ctr, anterior.ctr) },
        { etiqueta: "Posición media", valor: actual.posicionMedia.toFixed(1).replace(".", ","), delta: delta(actual.posicionMedia, anterior.posicionMedia, true) },
      ],
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.clics }))),
      hitos,
      keywords: keywordsTop.map((k) => ({ termino: k.query, clics: k.clics, impresiones: k.impresiones, ctr: k.ctr, posicion: k.posicion })),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de Search Console para este período.", kpis: [], serie: [], hitos: [], keywords: [] };
  }
}

async function seccionAeo(
  clientId: string,
  serviceId: string | null,
  ga4PropertyId: string | null,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
): Promise<SeccionAeo> {
  if (!ga4PropertyId) {
    return { disponible: false, motivo: "Configura el GA4 Property ID en la ficha del cliente.", totalSesiones: 0, deltaSesiones: null, porFuente: [] };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }] = await Promise.all([
      conCacheDeSnapshot<ResumenTraficoIA>({ clientId, serviceId, fuente: "ga4", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerTraficoIAGA4(ga4PropertyId, desde, hasta) }),
      conCacheDeSnapshot<ResumenTraficoIA>({ clientId, serviceId, fuente: "ga4", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerTraficoIAGA4(ga4PropertyId, desdeAnt, hastaAnt) }),
    ]);
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      totalSesiones: actual.totalSesiones,
      deltaSesiones: delta(actual.totalSesiones, anterior.totalSesiones),
      porFuente: actual.filas.map((f) => ({ fuente: f.fuente, sesiones: f.sesiones })).sort((a, b) => b.sesiones - a.sesiones),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de GA4 para este período.", totalSesiones: 0, deltaSesiones: null, porFuente: [] };
  }
}

async function seccionMeta(
  clientId: string,
  serviceId: string | null,
  metaAdAccountId: string | null,
  metaTokenKey: string | null,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
  hitos: Hito[],
): Promise<SeccionMeta> {
  if (!metaAdAccountId) {
    return { disponible: false, motivo: "Configura el Ad Account ID de Meta en la ficha del cliente.", kpis: [], serie: [], hitos: [], campanas: [] };
  }
  const config = { adAccountId: metaAdAccountId, metaTokenKey };
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria, campanas] = await Promise.all([
      conCacheDeSnapshot<ResumenInsightsMeta>({ clientId, serviceId, fuente: "meta", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerResumenMeta(config, desde, hasta) }),
      conCacheDeSnapshot<ResumenInsightsMeta>({ clientId, serviceId, fuente: "meta", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerResumenMeta(config, desdeAnt, hastaAnt) }),
      obtenerSerieDiariaMeta(config, desde, hasta),
      obtenerCampanasMeta(config, desde, hasta, 8),
    ]);
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      kpis: [
        { etiqueta: "Inversión", valor: fmtMoneda(actual.gasto), delta: delta(actual.gasto, anterior.gasto) },
        { etiqueta: "Resultados", valor: fmtNumero(actual.resultados), delta: delta(actual.resultados, anterior.resultados) },
        { etiqueta: "CTR", valor: `${actual.ctr.toFixed(2)}%`, delta: delta(actual.ctr, anterior.ctr) },
        { etiqueta: "CPC", valor: fmtMoneda(actual.cpc), delta: delta(actual.cpc, anterior.cpc, true) },
        { etiqueta: "Alcance", valor: fmtNumero(actual.alcance), delta: delta(actual.alcance, anterior.alcance) },
      ],
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.gasto }))),
      hitos,
      campanas: campanas.map((c) => ({ nombre: c.nombre || "(sin nombre)", gasto: c.gasto })).sort((a, b) => b.gasto - a.gasto),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de Meta para este período.", kpis: [], serie: [], hitos: [], campanas: [] };
  }
}

async function seccionGoogleAds(
  clientId: string,
  serviceId: string | null,
  ga4PropertyId: string | null,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
  hitos: Hito[],
): Promise<SeccionGoogleAds> {
  if (!ga4PropertyId) {
    return { disponible: false, motivo: "Configura el GA4 Property ID en la ficha del cliente.", kpis: [], serie: [], hitos: [] };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria] = await Promise.all([
      conCacheDeSnapshot<ResumenTraficoPagado>({ clientId, serviceId, fuente: "ga4", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerTraficoPagadoGA4(ga4PropertyId, desde, hasta) }),
      conCacheDeSnapshot<ResumenTraficoPagado>({ clientId, serviceId, fuente: "ga4", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerTraficoPagadoGA4(ga4PropertyId, desdeAnt, hastaAnt) }),
      obtenerTraficoPagadoDiarioGA4(ga4PropertyId, desde, hasta),
    ]);
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      kpis: [
        { etiqueta: "Sesiones pagas", valor: fmtNumero(actual.sesiones), delta: delta(actual.sesiones, anterior.sesiones) },
        { etiqueta: "Conversiones", valor: fmtNumero(actual.conversiones), delta: delta(actual.conversiones, anterior.conversiones) },
        { etiqueta: "Costo", valor: fmtMoneda(actual.costo, "CLP"), delta: delta(actual.costo, anterior.costo, true) },
      ],
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.sesiones }))),
      hitos,
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de GA4 para este período.", kpis: [], serie: [], hitos: [] };
  }
}

/**
 * Orquestador de la pestaña Resultados (§3.15) — comparte la capa de datos
 * de §3.14 (GSC/GA4/Meta + `conCacheDeSnapshot`) con el pre-llenado de
 * informes. Cada sección se resuelve por separado y degrada a
 * `disponible: false` con un motivo legible si el cliente no tiene la
 * propiedad/cuenta configurada o la API falla — nunca rompe la página.
 */
export async function obtenerResultadosCliente(clientId: string, rango: RangoResultados): Promise<ResultadosCliente | null> {
  const { actual, anterior } = calcularRangos(rango);

  const [[cliente], servicios, hitosPorTipo] = await Promise.all([
    sql<
      { nombre: string; gsc_property: string | null; ga4_property_id: string | null; meta_ad_account_id: string | null; meta_token_key: string | null }[]
    >`select nombre, gsc_property, ga4_property_id, meta_ad_account_id, meta_token_key from clients where id = ${clientId}`,
    sql<{ id: string; tipo: ServicioTipo }[]>`select id, tipo from services where client_id = ${clientId} and not pausado`,
    obtenerTodosLosHitos(clientId, actual.desde, actual.hasta),
  ]);
  if (!cliente) return null;

  const servicioIdPorTipo = new Map(servicios.map((s) => [s.tipo, s.id]));

  const [seo, aeo, meta, googleAds] = await Promise.all([
    servicioIdPorTipo.has("seo_aeo_geo")
      ? seccionSeo(clientId, servicioIdPorTipo.get("seo_aeo_geo")!, cliente.gsc_property, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.seo_aeo_geo)
      : ({ disponible: false, motivo: "Este cliente no tiene SEO-AEO-GEO contratado.", kpis: [], serie: [], hitos: [], keywords: [] } as SeccionSeo),
    servicioIdPorTipo.has("seo_aeo_geo")
      ? seccionAeo(clientId, servicioIdPorTipo.get("seo_aeo_geo")!, cliente.ga4_property_id, actual.desde, actual.hasta, anterior.desde, anterior.hasta)
      : ({ disponible: false, motivo: "Este cliente no tiene SEO-AEO-GEO contratado.", totalSesiones: 0, deltaSesiones: null, porFuente: [] } as SeccionAeo),
    servicioIdPorTipo.has("meta_ads")
      ? seccionMeta(clientId, servicioIdPorTipo.get("meta_ads")!, cliente.meta_ad_account_id, cliente.meta_token_key, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.meta_ads)
      : ({ disponible: false, motivo: "Este cliente no tiene Meta Ads contratado.", kpis: [], serie: [], hitos: [], campanas: [] } as SeccionMeta),
    servicioIdPorTipo.has("google_ads")
      ? seccionGoogleAds(clientId, servicioIdPorTipo.get("google_ads")!, cliente.ga4_property_id, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.google_ads)
      : ({ disponible: false, motivo: "Este cliente no tiene Google Ads contratado.", kpis: [], serie: [], hitos: [] } as SeccionGoogleAds),
  ]);

  return { clienteId: clientId, clienteNombre: cliente.nombre, rango, rangoFechas: actual, seo, aeo, meta, googleAds };
}

export { DOMINIOS_IA };
