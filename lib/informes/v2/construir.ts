import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, parseIso, toIso } from "@/lib/dates";
import { obtenerResultadosPeriodo } from "@/lib/data/resultados";
import type { ReportTipo } from "@/lib/data/informes";
import { AGENDA_URL_POR_DEFECTO, insightsVacios, type DatosV2, type InformeV2Contenido, type PeriodoV2 } from "@/lib/informes/v2/tipos";

/**
 * Ventana del informe de (mes, año): el mes completo (del 1 al último día) y,
 * para comparar, el mes anterior completo. Si es el mes en curso, del 1 a hoy
 * contra los mismos días del mes anterior. Search Console se desplaza solo lo
 * que haga falta por su retraso de 3 días (ver `desplazamientoGsc`).
 */
export function periodoDelInforme(mes: number, anio: number, hoy: Date = hoySantiago()): PeriodoV2 {
  const esMesEnCurso = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  const desde = toIso(new Date(anio, mes - 1, 1));
  const hasta = esMesEnCurso ? toIso(hoy) : toIso(new Date(anio, mes, 0));
  const anteriorHastaMes = addDaysIso(desde, -1);
  const anteriorDesde = `${anteriorHastaMes.slice(0, 7)}-01`;
  const dias = diasEntre(desde, hasta) + 1;
  const mismoLargo = addDaysIso(anteriorDesde, dias - 1);
  const anteriorHasta = esMesEnCurso && mismoLargo < anteriorHastaMes ? mismoLargo : anteriorHastaMes;
  return { desde, hasta, anteriorDesde, anteriorHasta, emitidoEn: toIso(hoy) };
}

export const MAX_DIAS_RANGO_PERSONALIZADO = 366;

function diasEntre(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

/** Rango elegido a mano: se compara con el período de igual largo inmediatamente anterior. Devuelve null si las fechas no sirven. */
export function periodoPersonalizado(desde: string, hasta: string, hoy: Date = hoySantiago()): PeriodoV2 | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
  const dias = diasEntre(desde, hasta) + 1;
  if (!(dias >= 1) || dias > MAX_DIAS_RANGO_PERSONALIZADO || hasta > toIso(hoy)) return null;
  const anteriorHasta = addDaysIso(desde, -1);
  const anteriorDesde = addDaysIso(anteriorHasta, -(dias - 1));
  return { desde, hasta, anteriorDesde, anteriorHasta, emitidoEn: toIso(hoy), personalizado: true };
}

const TIPOS_SERVICIO: Record<ReportTipo, string[]> = {
  seo_aeo_geo: ["seo_aeo_geo"],
  meta_ads: ["meta_ads"],
  google_ads: ["google_ads"],
  ads_combinado: ["meta_ads", "google_ads"],
};

function recortar(texto: string, max: number): string {
  const t = texto.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** "Lo que hicimos": primera línea del resumen de cada optimización realizada en la ventana. */
async function hechosDelPeriodo(clientId: string, tipo: ReportTipo, desde: string, hasta: string): Promise<string[]> {
  const rows = await sql<{ resumen: string }[]>`
    select resumen from optimizations
    where client_id = ${clientId} and estado = 'realizada' and tipo::text = any(${TIPOS_SERVICIO[tipo]})
      and resumen is not null and resumen != ''
      and fecha_realizada between ${desde} and ${hasta}
    order by fecha_realizada
    limit 8
  `;
  return rows.map((r) => recortar(r.resumen.split("\n").find((l) => l.trim()) ?? "", 200)).filter(Boolean);
}

/** "Lo que viene": los próximos pasos que dejó la última optimización realizada de cada servicio. */
async function proximosPasos(clientId: string, tipo: ReportTipo): Promise<string[]> {
  const rows = await sql<{ proximos_pasos: string }[]>`
    select distinct on (tipo) proximos_pasos from optimizations
    where client_id = ${clientId} and estado = 'realizada' and tipo::text = any(${TIPOS_SERVICIO[tipo]})
      and proximos_pasos is not null and proximos_pasos != ''
    order by tipo, fecha_realizada desc
  `;
  return rows
    .flatMap((r) => r.proximos_pasos.split("\n"))
    .map((l) => recortar(l.replace(/^\s*([-*•]|\d+[.)])\s*/, ""), 140))
    .filter((l) => l.length > 3)
    .slice(0, 5);
}

/** Contexto de bitácora del período para el prompt de Claude: optimizaciones realizadas, entradas de la bitácora y notas de reuniones. */
async function bitacoraDelPeriodo(clientId: string, tipo: ReportTipo, desde: string, hasta: string): Promise<string> {
  const optimizaciones = await sql<{ fecha: string; tipo: string; resumen: string | null; hallazgos: string | null; proximos_pasos: string | null }[]>`
    select fecha_realizada as fecha, tipo::text as tipo, resumen, hallazgos, proximos_pasos from optimizations
    where client_id = ${clientId} and estado = 'realizada' and tipo::text = any(${TIPOS_SERVICIO[tipo]})
      and fecha_realizada between ${desde} and ${hasta}
    order by fecha_realizada
  `;
  const entradas = await sql<{ fecha: string; contenido: string }[]>`
    select creado_en::date as fecha, contenido from log_entries
    where client_id = ${clientId} and creado_en::date between ${desde} and ${hasta}
    order by creado_en
  `;
  const reuniones = await sql<{ fecha: string; titulo: string; notas: string | null }[]>`
    select fecha, titulo, notas from meetings
    where client_id = ${clientId} and estado = 'realizada' and notas is not null and notas != '' and fecha between ${desde} and ${hasta}
    order by fecha
  `;
  const partes: string[] = [];
  if (optimizaciones.length) {
    partes.push("Optimizaciones realizadas:");
    for (const o of optimizaciones) {
      partes.push(`- ${o.fecha} · ${o.tipo === "meta_ads" ? "Meta Ads" : o.tipo === "google_ads" ? "Google Ads" : "SEO"}: ${recortar(o.resumen ?? "", 500)}`);
      if (o.hallazgos?.trim()) partes.push(`  Hallazgos: ${recortar(o.hallazgos, 400)}`);
      if (o.proximos_pasos?.trim()) partes.push(`  Próximos pasos: ${recortar(o.proximos_pasos, 400)}`);
    }
  }
  if (entradas.length) {
    partes.push("", "Entradas de la bitácora del cliente:");
    for (const e of entradas) partes.push(`- ${e.fecha}: ${recortar(e.contenido, 350)}`);
  }
  if (reuniones.length) {
    partes.push("", "Reuniones con el cliente (notas internas, para contexto; no se citan en el informe):");
    for (const r of reuniones) partes.push(`- ${r.fecha} · ${r.titulo}: ${recortar(r.notas ?? "", 400)}`);
  }
  const texto = partes.join("\n");
  return texto.length <= 7000 ? texto : `${texto.slice(0, 6999).trimEnd()}…`;
}

/**
 * Arma el informe v2 completo: la misma foto de datos que muestra la pestaña
 * Resultados (con su caché de snapshots si una API falla) para la ventana del
 * informe, más "lo que hicimos" y "lo que viene" prellenados desde la
 * bitácora. Los insights quedan vacíos: se completan con Claude desde el
 * editor del informe.
 */
export async function construirInformeV2(clientId: string, tipo: ReportTipo, mes: number, anio: number, rango?: { desde: string; hasta: string } | null): Promise<InformeV2Contenido> {
  const periodo = (rango ? periodoPersonalizado(rango.desde, rango.hasta) : null) ?? periodoDelInforme(mes, anio);
  const [resultados, hechos, proximos, bitacora] = await Promise.all([
    obtenerResultadosPeriodo(clientId, 28, { desde: periodo.desde, hasta: periodo.hasta }, { desde: periodo.anteriorDesde, hasta: periodo.anteriorHasta }),
    hechosDelPeriodo(clientId, tipo, periodo.desde, periodo.hasta),
    proximosPasos(clientId, tipo),
    bitacoraDelPeriodo(clientId, tipo, periodo.desde, periodo.hasta),
  ]);

  const datos: DatosV2 = {};
  if (resultados) {
    if (tipo === "seo_aeo_geo") {
      datos.seo = { ...resultados.seo, hitos: [] };
      datos.aeo = resultados.aeo;
    }
    if (tipo === "meta_ads" || tipo === "ads_combinado") datos.meta = { ...resultados.meta, hitos: [] };
    if (tipo === "google_ads" || tipo === "ads_combinado") datos.googleAds = { ...resultados.googleAds, hitos: [] };
  }

  return { version: 2, periodo, datos, insights: insightsVacios(), hechos, proximos, bitacora, agendaUrl: AGENDA_URL_POR_DEFECTO };
}
