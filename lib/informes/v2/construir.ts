import { sql } from "@/lib/db";
import { addDaysIso, hoySantiago, toIso } from "@/lib/dates";
import { obtenerResultadosPeriodo } from "@/lib/data/resultados";
import type { ReportTipo } from "@/lib/data/informes";
import { AGENDA_URL_POR_DEFECTO, insightsVacios, type DatosV2, type InformeV2Contenido, type PeriodoV2 } from "@/lib/informes/v2/tipos";

/** Días de cada ventana del informe (la actual y la anterior con la que se compara). */
const DIAS_VENTANA = 28;

/**
 * Ventana del informe de (mes, año): 28 días terminando el día de emisión —
 * hoy si es el mes en curso, o el último día de ese mes si es uno pasado — y
 * los 28 anteriores para comparar. Mismo criterio que el rango "28 días" de
 * la pestaña Resultados (Search Console se desplaza 3 días por su retraso).
 */
export function periodoDelInforme(mes: number, anio: number, hoy: Date = hoySantiago()): PeriodoV2 {
  const esMesEnCurso = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  const hasta = esMesEnCurso ? toIso(hoy) : toIso(new Date(anio, mes, 0));
  const desde = addDaysIso(hasta, -(DIAS_VENTANA - 1));
  const anteriorHasta = addDaysIso(desde, -1);
  const anteriorDesde = addDaysIso(anteriorHasta, -(DIAS_VENTANA - 1));
  return { desde, hasta, anteriorDesde, anteriorHasta, emitidoEn: toIso(hoy) };
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

/**
 * Arma el informe v2 completo: la misma foto de datos que muestra la pestaña
 * Resultados (con su caché de snapshots si una API falla) para la ventana del
 * informe, más "lo que hicimos" y "lo que viene" prellenados desde la
 * bitácora. Los insights quedan vacíos: se completan con Claude desde el
 * editor del informe.
 */
export async function construirInformeV2(clientId: string, tipo: ReportTipo, mes: number, anio: number): Promise<InformeV2Contenido> {
  const periodo = periodoDelInforme(mes, anio);
  const [resultados, hechos, proximos] = await Promise.all([
    obtenerResultadosPeriodo(clientId, 28, { desde: periodo.desde, hasta: periodo.hasta }, { desde: periodo.anteriorDesde, hasta: periodo.anteriorHasta }),
    hechosDelPeriodo(clientId, tipo, periodo.desde, periodo.hasta),
    proximosPasos(clientId, tipo),
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

  return { version: 2, periodo, datos, insights: insightsVacios(), hechos, proximos, agendaUrl: AGENDA_URL_POR_DEFECTO };
}
