import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, toIso } from "@/lib/dates";
import { conCacheDeSnapshot } from "@/lib/metricas/snapshot";
import { obtenerKeywordsGSC, obtenerResumenGSC, obtenerSerieDiariaGSC, type ResumenGSC } from "@/lib/google/gsc";
import {
  DOMINIOS_IA,
  obtenerCampanasPagadoGA4,
  obtenerPaginasDestinoIAGA4,
  obtenerTraficoIAGA4,
  obtenerTraficoOrganicoGA4,
  obtenerTraficoPagadoDiarioGA4,
  obtenerTraficoPagadoGA4,
  type ResumenGA4Organico,
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

/** Tabla de campañas compartida por Meta Ads y Google Ads — "interacciones" es clics (Meta) o sesiones (Google Ads vía GA4), cada sección rotula la columna a su manera. */
export interface FilaCampana {
  nombre: string;
  interacciones: number;
  conversiones: number;
  tasaConversion: number;
  costoPorConversion: number | null;
}

export interface Funnel {
  impresiones: number;
  clics: number;
  conversiones: number;
  pctImpresionesAClics: number;
  pctClicsAConversiones: number;
}

export interface DistribucionPosiciones {
  top3: number;
  top10: number;
  top20: number;
  top50: number;
  mas50: number;
  total: number;
}

export interface SeccionSeo {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  insight: string | null;
  kpis: KpiResultado[];
  funnel: Funnel | null;
  serie: PuntoSerie[];
  hitos: Hito[];
  keywords: { termino: string; clics: number; impresiones: number; ctr: number; posicion: number; deltaPosicion: number | null }[];
  distribucionPosiciones: DistribucionPosiciones | null;
}

export interface SeccionAeo {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  insight: string | null;
  totalSesiones: number;
  deltaSesiones: Delta | null;
  tasaConversion: number | null;
  porFuente: { fuente: string; sesiones: number }[];
  paginasDestino: { pagina: string; sesiones: number; conversiones: number }[];
}

export interface SeccionMeta {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  insight: string | null;
  kpis: KpiResultado[];
  serie: PuntoSerie[];
  hitos: Hito[];
  campanas: FilaCampana[];
}

export interface SeccionGoogleAds {
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  insight: string | null;
  kpis: KpiResultado[];
  serie: PuntoSerie[];
  hitos: Hito[];
  campanas: FilaCampana[];
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

function armarCampanas(filas: { nombre: string; interacciones: number; conversiones: number; gastoOCosto: number }[]): FilaCampana[] {
  return filas
    .map((f) => ({
      nombre: f.nombre,
      interacciones: f.interacciones,
      conversiones: f.conversiones,
      tasaConversion: f.interacciones > 0 ? f.conversiones / f.interacciones : 0,
      costoPorConversion: f.conversiones > 0 ? f.gastoOCosto / f.conversiones : null,
    }))
    .sort((a, b) => b.interacciones - a.interacciones);
}

/** Igual criterio que fmtDeltaPct: con un período anterior casi en cero el % explota — se acota a 999 para que la frase siga siendo legible. */
const abs1 = (n: number) => Math.min(Math.abs(n), 999).toString().replace(".", ",");

/**
 * Frases de una línea que conectan la métrica con el resultado de negocio
 * — es el elemento que le faltaba a la primera versión (KPIs sueltos sin
 * lectura). Reglas simples, no IA (eso es Fase 4, §3.4 "asistencia de
 * IA"): comparan la dirección de dos deltas y arman una lectura, igual
 * que haría alguien mirando el dashboard en una reunión con el cliente.
 */
function insightTrafico(nombreCanal: string, deltaVisitas: Delta, deltaConversiones: Delta): string | null {
  if (deltaVisitas.pct === null || deltaConversiones.pct === null) return null;
  const visitas = `${nombreCanal} ${deltaVisitas.tendencia === "down" ? "bajó" : deltaVisitas.tendencia === "up" ? "subió" : "se mantuvo estable"}${deltaVisitas.tendencia !== "flat" ? ` ${abs1(deltaVisitas.pct)}%` : ""}`;
  const conv = `${abs1(deltaConversiones.pct)}%`;
  if (deltaVisitas.favorable && deltaConversiones.favorable) return `${visitas} y las conversiones también subieron (+${conv}) → el canal está sano.`;
  if (deltaVisitas.favorable && !deltaConversiones.favorable) {
    return `${visitas}, pero las conversiones no acompañaron ese ritmo (-${conv}) → vale la pena revisar la calidad del tráfico o la experiencia de conversión.`;
  }
  if (!deltaVisitas.favorable && deltaConversiones.favorable) return `${visitas}, pero las conversiones subieron (+${conv}) → el tráfico que llega está convirtiendo mejor.`;
  return `${visitas} y las conversiones también bajaron (-${conv}) → conviene revisar el canal antes del próximo período.`;
}

function insightAds(deltaCosto: Delta, deltaResultados: Delta): string | null {
  if (deltaCosto.pct === null || deltaResultados.pct === null) return null;
  const costoTxt = `El costo por conversión ${deltaCosto.tendencia === "down" ? "bajó" : deltaCosto.tendencia === "up" ? "subió" : "se mantuvo"}${deltaCosto.tendencia !== "flat" ? ` ${abs1(deltaCosto.pct)}%` : ""}`;
  const resultadosTxt = `las conversiones ${deltaResultados.tendencia === "up" ? "subieron" : deltaResultados.tendencia === "down" ? "bajaron" : "se mantuvieron"}${deltaResultados.tendencia !== "flat" ? ` ${abs1(deltaResultados.pct)}%` : ""}`;
  if (deltaCosto.favorable && deltaResultados.favorable) return `${costoTxt} mientras ${resultadosTxt} → la inversión está rindiendo mejor.`;
  if (!deltaCosto.favorable && !deltaResultados.favorable) return `${costoTxt} y ${resultadosTxt} → vale la pena revisar las campañas antes de seguir invirtiendo igual.`;
  if (deltaCosto.favorable && !deltaResultados.favorable) return `${costoTxt}, pero ${resultadosTxt} → el ahorro no se está traduciendo en más resultados.`;
  return `${costoTxt}, aunque ${resultadosTxt} → la inversión extra sí está trayendo más resultados.`;
}

function insightAeo(tasaIA: number | null, tasaOrganica: number | null, sesionesIA: number): string | null {
  if (sesionesIA === 0) return null;
  if (tasaIA === null || tasaOrganica === null || tasaOrganica === 0) {
    return `${fmtNumero(sesionesIA)} sesiones llegaron desde IAs este período — todavía sin suficiente historial para comparar su conversión contra el resto del tráfico.`;
  }
  const factor = tasaIA / tasaOrganica;
  if (factor >= 1.15) return `El tráfico desde IA convierte ${factor.toFixed(1)}x mejor que el orgánico tradicional (${fmtPct(tasaIA)} vs ${fmtPct(tasaOrganica)}) → es un canal de alta intención, aunque todavía pequeño en volumen.`;
  if (factor <= 0.85) return `El tráfico desde IA convierte peor que el orgánico tradicional (${fmtPct(tasaIA)} vs ${fmtPct(tasaOrganica)}) → probablemente llega en una etapa más temprana de la decisión.`;
  return `El tráfico desde IA convierte en línea con el orgánico tradicional (${fmtPct(tasaIA)} vs ${fmtPct(tasaOrganica)}) → ya es un canal comparable, no solo exploratorio.`;
}

interface OrganicoActualAnterior {
  actual: ResumenGA4Organico;
  anterior: ResumenGA4Organico;
}

async function seccionSeo(
  clientId: string,
  serviceId: string | null,
  gscProperty: string | null,
  organicoPromise: Promise<OrganicoActualAnterior | null>,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
  hitos: Hito[],
): Promise<SeccionSeo> {
  if (!gscProperty) {
    return { disponible: false, motivo: "Configura la propiedad de Search Console en la ficha del cliente.", insight: null, kpis: [], funnel: null, serie: [], hitos: [], keywords: [], distribucionPosiciones: null };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria, keywordsActual, keywordsAnterior, organico] = await Promise.all([
      conCacheDeSnapshot<ResumenGSC>({ clientId, serviceId, fuente: "gsc", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerResumenGSC(gscProperty, desde, hasta) }),
      conCacheDeSnapshot<ResumenGSC>({ clientId, serviceId, fuente: "gsc", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerResumenGSC(gscProperty, desdeAnt, hastaAnt) }),
      obtenerSerieDiariaGSC(gscProperty, desde, hasta),
      // Límite alto (no solo el top 10 de la tabla): hace falta el conjunto
      // completo de keywords para que la distribución de posiciones (donut)
      // sea representativa, no solo de las 10 con más clics.
      obtenerKeywordsGSC(gscProperty, desde, hasta, 250),
      obtenerKeywordsGSC(gscProperty, desdeAnt, hastaAnt, 250).catch(() => []),
      organicoPromise,
    ]);

    const posicionAnteriorPorQuery = new Map(keywordsAnterior.map((k) => [k.query, k.posicion]));
    const distribucionPosiciones: DistribucionPosiciones = { top3: 0, top10: 0, top20: 0, top50: 0, mas50: 0, total: keywordsActual.length };
    for (const k of keywordsActual) {
      if (k.posicion <= 3) distribucionPosiciones.top3++;
      else if (k.posicion <= 10) distribucionPosiciones.top10++;
      else if (k.posicion <= 20) distribucionPosiciones.top20++;
      else if (k.posicion <= 50) distribucionPosiciones.top50++;
      else distribucionPosiciones.mas50++;
    }
    const keywordsTop = [...keywordsActual].sort((a, b) => b.clics - a.clics).slice(0, 10);

    const kpis: KpiResultado[] = [
      { etiqueta: "Clics", valor: fmtNumero(actual.clics), delta: delta(actual.clics, anterior.clics) },
      { etiqueta: "Impresiones", valor: fmtNumero(actual.impresiones), delta: delta(actual.impresiones, anterior.impresiones) },
      { etiqueta: "CTR", valor: fmtPct(actual.ctr), delta: delta(actual.ctr, anterior.ctr) },
      { etiqueta: "Posición media", valor: actual.posicionMedia.toFixed(1).replace(".", ","), delta: delta(actual.posicionMedia, anterior.posicionMedia, true) },
    ];

    let funnel: Funnel | null = null;
    let insight: string | null = null;
    if (organico) {
      const { actual: convActual, anterior: convAnterior } = organico;
      const tasaConv = convActual.sesiones > 0 ? convActual.conversiones / convActual.sesiones : 0;
      const tasaConvAnt = convAnterior.sesiones > 0 ? convAnterior.conversiones / convAnterior.sesiones : 0;
      kpis.push(
        { etiqueta: "Conversiones orgánicas", valor: fmtNumero(convActual.conversiones), delta: delta(convActual.conversiones, convAnterior.conversiones) },
        { etiqueta: "Tasa de conversión", valor: fmtPct(tasaConv), delta: delta(tasaConv, tasaConvAnt) },
      );
      funnel = {
        impresiones: actual.impresiones,
        clics: actual.clics,
        conversiones: convActual.conversiones,
        pctImpresionesAClics: actual.ctr,
        pctClicsAConversiones: tasaConv,
      };
      insight = insightTrafico("El tráfico orgánico", delta(actual.clics, anterior.clics), delta(convActual.conversiones, convAnterior.conversiones));
    }

    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      insight,
      kpis,
      funnel,
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.clics }))),
      hitos,
      keywords: keywordsTop.map((k) => {
        const posicionAnterior = posicionAnteriorPorQuery.get(k.query);
        return {
          termino: k.query,
          clics: k.clics,
          impresiones: k.impresiones,
          ctr: k.ctr,
          posicion: k.posicion,
          deltaPosicion: posicionAnterior !== undefined ? Math.round((posicionAnterior - k.posicion) * 10) / 10 : null,
        };
      }),
      distribucionPosiciones,
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de Search Console para este período.", insight: null, kpis: [], funnel: null, serie: [], hitos: [], keywords: [], distribucionPosiciones: null };
  }
}

async function seccionAeo(
  clientId: string,
  serviceId: string | null,
  ga4PropertyId: string | null,
  organicoPromise: Promise<OrganicoActualAnterior | null>,
  desde: string,
  hasta: string,
  desdeAnt: string,
  hastaAnt: string,
): Promise<SeccionAeo> {
  if (!ga4PropertyId) {
    return { disponible: false, motivo: "Configura el GA4 Property ID en la ficha del cliente.", insight: null, totalSesiones: 0, deltaSesiones: null, tasaConversion: null, porFuente: [], paginasDestino: [] };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, paginasDestino, organico] = await Promise.all([
      conCacheDeSnapshot<ResumenTraficoIA>({ clientId, serviceId, fuente: "ga4", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerTraficoIAGA4(ga4PropertyId, desde, hasta) }),
      conCacheDeSnapshot<ResumenTraficoIA>({ clientId, serviceId, fuente: "ga4", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerTraficoIAGA4(ga4PropertyId, desdeAnt, hastaAnt) }),
      obtenerPaginasDestinoIAGA4(ga4PropertyId, desde, hasta).catch(() => []),
      organicoPromise,
    ]);
    const conversionesIA = actual.filas.reduce((s, f) => s + f.conversiones, 0);
    const tasaConversion = actual.totalSesiones > 0 ? conversionesIA / actual.totalSesiones : null;
    const tasaOrganica = organico && organico.actual.sesiones > 0 ? organico.actual.conversiones / organico.actual.sesiones : null;
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      insight: insightAeo(tasaConversion, tasaOrganica, actual.totalSesiones),
      totalSesiones: actual.totalSesiones,
      deltaSesiones: delta(actual.totalSesiones, anterior.totalSesiones),
      tasaConversion,
      porFuente: actual.filas.map((f) => ({ fuente: f.fuente, sesiones: f.sesiones })).sort((a, b) => b.sesiones - a.sesiones),
      paginasDestino: paginasDestino.map((p) => ({ pagina: p.pagina, sesiones: p.sesiones, conversiones: p.conversiones })),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de GA4 para este período.", insight: null, totalSesiones: 0, deltaSesiones: null, tasaConversion: null, porFuente: [], paginasDestino: [] };
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
    return { disponible: false, motivo: "Configura el Ad Account ID de Meta en la ficha del cliente.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] };
  }
  const config = { adAccountId: metaAdAccountId, metaTokenKey };
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria, campanas] = await Promise.all([
      conCacheDeSnapshot<ResumenInsightsMeta>({ clientId, serviceId, fuente: "meta", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerResumenMeta(config, desde, hasta) }),
      conCacheDeSnapshot<ResumenInsightsMeta>({ clientId, serviceId, fuente: "meta", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerResumenMeta(config, desdeAnt, hastaAnt) }),
      obtenerSerieDiariaMeta(config, desde, hasta),
      obtenerCampanasMeta(config, desde, hasta, 8),
    ]);
    const costoActual = actual.resultados > 0 ? actual.gasto / actual.resultados : 0;
    const costoAnterior = anterior.resultados > 0 ? anterior.gasto / anterior.resultados : 0;
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      insight: insightAds(delta(costoActual, costoAnterior, true), delta(actual.resultados, anterior.resultados)),
      kpis: [
        { etiqueta: "Inversión", valor: fmtMoneda(actual.gasto), delta: delta(actual.gasto, anterior.gasto) },
        { etiqueta: "Resultados", valor: fmtNumero(actual.resultados), delta: delta(actual.resultados, anterior.resultados) },
        { etiqueta: "Costo por resultado", valor: fmtMoneda(costoActual), delta: delta(costoActual, costoAnterior, true) },
        { etiqueta: "CTR", valor: `${actual.ctr.toFixed(2)}%`, delta: delta(actual.ctr, anterior.ctr) },
        { etiqueta: "Alcance", valor: fmtNumero(actual.alcance), delta: delta(actual.alcance, anterior.alcance) },
      ],
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.gasto }))),
      hitos,
      campanas: armarCampanas(campanas.map((c) => ({ nombre: c.nombre || "(sin nombre)", interacciones: c.clics, conversiones: c.resultados, gastoOCosto: c.gasto }))),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de Meta para este período.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] };
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
    return { disponible: false, motivo: "Configura el GA4 Property ID en la ficha del cliente.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] };
  }
  try {
    const [{ datos: actual, deCache }, { datos: anterior }, serieDiaria, campanas] = await Promise.all([
      conCacheDeSnapshot<ResumenTraficoPagado>({ clientId, serviceId, fuente: "ga4", periodoInicio: desde, periodoFin: hasta, fetchLive: () => obtenerTraficoPagadoGA4(ga4PropertyId, desde, hasta) }),
      conCacheDeSnapshot<ResumenTraficoPagado>({ clientId, serviceId, fuente: "ga4", periodoInicio: desdeAnt, periodoFin: hastaAnt, fetchLive: () => obtenerTraficoPagadoGA4(ga4PropertyId, desdeAnt, hastaAnt) }),
      obtenerTraficoPagadoDiarioGA4(ga4PropertyId, desde, hasta),
      // Sin conCacheDeSnapshot: mismo motivo que las conversiones orgánicas de
      // SEO — este desglose por campaña tiene otra forma que el resumen
      // actual/anterior de arriba, y ambos comparten (cliente, servicio,
      // fuente, período); cachearlo ahí generaría la misma colisión.
      obtenerCampanasPagadoGA4(ga4PropertyId, desde, hasta, 8).catch(() => []),
    ]);
    const costoActual = actual.conversiones > 0 ? actual.costo / actual.conversiones : 0;
    const costoAnterior = anterior.conversiones > 0 ? anterior.costo / anterior.conversiones : 0;
    const tasaConv = actual.sesiones > 0 ? actual.conversiones / actual.sesiones : 0;
    const tasaConvAnt = anterior.sesiones > 0 ? anterior.conversiones / anterior.sesiones : 0;
    return {
      disponible: true,
      deCache: deCache ? "Datos del último snapshot disponible (la API no respondió)." : null,
      insight: insightAds(delta(costoActual, costoAnterior, true), delta(actual.conversiones, anterior.conversiones)),
      kpis: [
        { etiqueta: "Sesiones pagas", valor: fmtNumero(actual.sesiones), delta: delta(actual.sesiones, anterior.sesiones) },
        { etiqueta: "Conversiones", valor: fmtNumero(actual.conversiones), delta: delta(actual.conversiones, anterior.conversiones) },
        { etiqueta: "Tasa de conversión", valor: fmtPct(tasaConv), delta: delta(tasaConv, tasaConvAnt) },
        { etiqueta: "Costo por conversión", valor: fmtMoneda(costoActual, "CLP"), delta: delta(costoActual, costoAnterior, true) },
      ],
      serie: rellenarDias(desde, hasta, serieDiaria.map((p) => ({ fecha: p.fecha, valor: p.sesiones }))),
      hitos,
      campanas: armarCampanas(campanas.map((c) => ({ nombre: c.nombre, interacciones: c.sesiones, conversiones: c.conversiones, gastoOCosto: c.costo }))),
    };
  } catch {
    return { disponible: false, motivo: "No se pudo obtener datos de GA4 para este período.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] };
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

  // Compartido entre SEO (funnel/KPIs de conversión) y AEO (comparar tasa de
  // conversión IA vs. orgánica) — se pide una sola vez para no duplicar la
  // llamada a GA4 ni cachearla dos veces bajo la misma (cliente, servicio,
  // fuente, período) con formas distintas (ver comentarios en cada sección).
  // Es una promesa (no `await` acá) para que corra en paralelo con Meta y
  // Google Ads en vez de bloquear el resto de las secciones.
  const organicoPromise: Promise<OrganicoActualAnterior | null> =
    servicioIdPorTipo.has("seo_aeo_geo") && cliente.ga4_property_id
      ? Promise.all([
          obtenerTraficoOrganicoGA4(cliente.ga4_property_id, actual.desde, actual.hasta),
          obtenerTraficoOrganicoGA4(cliente.ga4_property_id, anterior.desde, anterior.hasta),
        ])
          .then(([a, b]) => ({ actual: a, anterior: b }))
          .catch(() => null)
      : Promise.resolve(null);

  const [seo, aeo, meta, googleAds] = await Promise.all([
    servicioIdPorTipo.has("seo_aeo_geo")
      ? seccionSeo(clientId, servicioIdPorTipo.get("seo_aeo_geo")!, cliente.gsc_property, organicoPromise, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.seo_aeo_geo)
      : ({ disponible: false, motivo: "Este cliente no tiene SEO-AEO-GEO contratado.", insight: null, kpis: [], funnel: null, serie: [], hitos: [], keywords: [], distribucionPosiciones: null } as SeccionSeo),
    servicioIdPorTipo.has("seo_aeo_geo")
      ? seccionAeo(clientId, servicioIdPorTipo.get("seo_aeo_geo")!, cliente.ga4_property_id, organicoPromise, actual.desde, actual.hasta, anterior.desde, anterior.hasta)
      : ({ disponible: false, motivo: "Este cliente no tiene SEO-AEO-GEO contratado.", insight: null, totalSesiones: 0, deltaSesiones: null, tasaConversion: null, porFuente: [], paginasDestino: [] } as SeccionAeo),
    servicioIdPorTipo.has("meta_ads")
      ? seccionMeta(clientId, servicioIdPorTipo.get("meta_ads")!, cliente.meta_ad_account_id, cliente.meta_token_key, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.meta_ads)
      : ({ disponible: false, motivo: "Este cliente no tiene Meta Ads contratado.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] } as SeccionMeta),
    servicioIdPorTipo.has("google_ads")
      ? seccionGoogleAds(clientId, servicioIdPorTipo.get("google_ads")!, cliente.ga4_property_id, actual.desde, actual.hasta, anterior.desde, anterior.hasta, hitosPorTipo.google_ads)
      : ({ disponible: false, motivo: "Este cliente no tiene Google Ads contratado.", insight: null, kpis: [], serie: [], hitos: [], campanas: [] } as SeccionGoogleAds),
  ]);

  return { clienteId: clientId, clienteNombre: cliente.nombre, rango, rangoFechas: actual, seo, aeo, meta, googleAds };
}

export { DOMINIOS_IA };
