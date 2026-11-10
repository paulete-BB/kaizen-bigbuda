/**
 * Insights del informe v2: Kaizen arma un prompt con los datos del período,
 * la persona lo pega en Claude (claude.ai o la extensión del navegador, con
 * su suscripción — la API de Anthropic no se usa) y pega de vuelta la
 * respuesta, que se separa en 3 frases por servicio. Mismo patrón que el
 * briefing de las optimizaciones de Ads.
 */
import type { KpiResultado } from "@/lib/data/resultados";
import type { ReportTipo } from "@/lib/data/informes";
import { INSIGHTS_POR_SECCION, LARGO_INSIGHT_OBJETIVO, type InformeV2Contenido, type SeccionInsight } from "@/lib/informes/v2/tipos";
import { comoValor, rangoLargo } from "@/lib/informes/v2/slides";

export const ETIQUETA_SECCION: Record<SeccionInsight, string> = {
  seo: "SEO · AEO · GEO",
  meta: "Meta Ads",
  googleAds: "Google Ads",
};

/** Secciones de insights que corresponden a este tipo de informe y tienen datos. */
export function seccionesDeInsights(tipo: ReportTipo, c: InformeV2Contenido): SeccionInsight[] {
  const out: SeccionInsight[] = [];
  if (tipo === "seo_aeo_geo" && (c.datos.seo?.disponible || c.datos.aeo?.disponible)) out.push("seo");
  if ((tipo === "meta_ads" || tipo === "ads_combinado") && c.datos.meta?.disponible) out.push("meta");
  if ((tipo === "google_ads" || tipo === "ads_combinado") && c.datos.googleAds?.disponible) out.push("googleAds");
  return out;
}

function lineaKpi(k: KpiResultado): string {
  const cambio = k.delta ? (k.delta.pct === null ? "sin dato anterior" : `${k.delta.pct > 0 ? "+" : ""}${Math.round(k.delta.pct * 10) / 10}%`) : "sin comparación";
  const antes = k.anteriorNum !== undefined ? ` (antes: ${comoValor(k.valor, k.anteriorNum)})` : "";
  return `- ${k.etiqueta}: ${k.valor}${antes}, cambio ${cambio}`;
}

function bloqueDatos(seccion: SeccionInsight, c: InformeV2Contenido): string {
  const partes: string[] = [];
  if (seccion === "seo") {
    const seo = c.datos.seo;
    if (seo?.disponible) {
      partes.push("Search Console y Analytics (SEO):", ...seo.kpis.map(lineaKpi));
      if (seo.funnel) partes.push(`- Embudo: ${seo.funnel.impresiones} apariciones → ${seo.funnel.clics} clics → ${seo.funnel.conversiones} conversiones`);
      if (seo.distribucionPosiciones) {
        const d = seo.distribucionPosiciones;
        partes.push(`- Consultas medidas: ${d.total}; en el top 3: ${d.top3}; en el top 10: ${d.top3 + d.top10}; entre el puesto 11 y el 20: ${d.top20}; más allá del 50: ${d.mas50}`);
      }
      if (seo.keywords.length) {
        partes.push("Búsquedas con más clics (clics, puesto medio, cambio de puestos vs. período anterior):");
        for (const k of seo.keywords.slice(0, 8)) partes.push(`- "${k.termino}": ${k.clics} clics, puesto ${k.posicion.toFixed(1)}, ${k.deltaPosicion === null ? "nueva" : `${k.deltaPosicion > 0 ? "subió" : k.deltaPosicion < 0 ? "bajó" : "igual"} ${Math.abs(k.deltaPosicion)}`}`);
      }
    }
    const aeo = c.datos.aeo;
    if (aeo?.disponible) {
      partes.push("", "Visitas desde asistentes de IA (GA4):", `- Total: ${aeo.totalSesiones} visitas${aeo.deltaSesiones?.pct != null ? `, cambio ${aeo.deltaSesiones.pct}%` : ""}${aeo.tasaConversion !== null ? `, tasa de conversión ${(aeo.tasaConversion * 100).toFixed(1)}%` : ""}`);
      for (const p of aeo.paginasDestino.slice(0, 4)) partes.push(`- Llegan a ${p.pagina}: ${p.sesiones} visitas, ${p.conversiones} conversiones`);
    }
  } else {
    const s = seccion === "meta" ? c.datos.meta : c.datos.googleAds;
    if (s?.disponible) {
      partes.push(`${ETIQUETA_SECCION[seccion]}:`, ...s.kpis.map(lineaKpi));
      if (s.campanas.length) {
        partes.push("Campañas:");
        for (const f of s.campanas.slice(0, 6)) partes.push(`- "${f.nombre}": ${f.interacciones} clics/visitas, ${f.conversiones} conversiones, costo por conversión ${f.costoPorConversion !== null ? `$${(Math.round(f.costoPorConversion * 100) / 100).toLocaleString("es-CL")}` : "sin dato"}`);
      }
    }
  }
  return partes.join("\n");
}

/** Prompt completo para pegar en Claude. Pide 3 frases por servicio en un formato fijo que `parsearInsights` entiende. */
export function construirPromptInsights(o: { clienteNombre: string; industria?: string | null; mesAnioLabel: string; tipo: ReportTipo; contenido: InformeV2Contenido }): string {
  const c = o.contenido;
  const secciones = seccionesDeInsights(o.tipo, c);
  const formatoInsights = secciones.map((s) => `## ${ETIQUETA_SECCION[s]}\n- (frase 1)\n- (frase 2)\n- (frase 3)`).join("\n\n");
  const datos = secciones.map((s) => `### ${ETIQUETA_SECCION[s]}\n${bloqueDatos(s, c)}`).join("\n\n");
  const bitacora = (c.bitacora ?? "").trim();

  return `/paid-media-senior

Vas a escribir el contenido de texto del informe mensual de nuestro cliente. Lo lee el dueño del negocio: no es técnico, así que habla de clientes, ventas y contactos, no de métricas internas.

CLIENTE: ${o.clienteNombre}${o.industria ? ` (${o.industria})` : ""}
INFORME: ${o.mesAnioLabel}
PERÍODO: ${rangoLargo(c.periodo.desde, c.periodo.hasta)}, comparado con ${rangoLargo(c.periodo.anteriorDesde, c.periodo.anteriorHasta)}

QUÉ ESCRIBIR
1) INSIGHTS: EXACTAMENTE ${INSIGHTS_POR_SECCION} frases por servicio, de unos ${LARGO_INSIGHT_OBJETIVO} caracteres cada una (nunca más de ${LARGO_INSIGHT_OBJETIVO + 15}; cuéntalas, tienen que caber en una tarjeta). Cada frase es una idea distinta: (1) qué pasó, con la cifra concreta; (2) por qué le importa al negocio; (3) qué haremos o qué esperar.
2) LO QUE HICIMOS: 3 a 5 acciones del período en lenguaje de negocio, una línea cada una (máx. ~120 caracteres), sacadas de la bitácora de abajo. Nada técnico ni interno.
3) LO QUE VIENE: 3 a 5 próximos pasos (máx. ~100 caracteres cada uno), en orden de prioridad, coherentes con los datos y con los próximos pasos de la bitácora.

REGLAS
- Usa solo las cifras y hechos de los datos y la bitácora de abajo. No inventes números, causas ni acciones.
- Si algo empeoró, dilo con honestidad y di qué haremos. No exageres lo bueno.
- Montos con el formato $1.234 (sin escribir CLP, USD ni otra moneda).
- Español de Chile, sin emojis, sin jerga (di "visitas", no "sesiones"; "puesto en Google", no "posición media").
- No menciones reuniones ni notas internas.

DATOS DEL PERÍODO
${datos}

BITÁCORA DEL PERÍODO
${bitacora || "(sin registros en el período: escribe LO QUE HICIMOS solo si se puede deducir de los datos; si no, deja esa sección con una sola línea que diga \"Sin acciones registradas\")"}

FORMATO DE RESPUESTA (respeta los títulos y los guiones; nada más)
${formatoInsights}

## Lo que hicimos
- (acción 1)
- (acción 2)
- (acción 3)

## Lo que viene
- (paso 1)
- (paso 2)
- (paso 3)`;
}

const SECCION_POR_TITULO: [RegExp, SeccionInsight][] = [
  [/google\s*ads/i, "googleAds"],
  [/meta/i, "meta"],
  [/seo|aeo|geo|posicionamiento/i, "seo"],
];

function limpiar(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^["“«]+|["”»]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RespuestaParseada {
  insights: Partial<Record<SeccionInsight, string[]>>;
  hechos: string[];
  proximos: string[];
}

/** Separa la respuesta de Claude en insights por servicio y las listas "lo que hicimos" / "lo que viene". Tolera títulos con o sin `#`/negritas y viñetas `-`, `*`, `•` o `1.`. */
export function parsearRespuesta(texto: string): RespuestaParseada {
  const out: RespuestaParseada = { insights: {}, hechos: [], proximos: [] };
  let actual: SeccionInsight | "hechos" | "proximos" | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.trim();
    if (!linea) continue;
    const esViñeta = /^([-*•]|\d+[.)])\s+/.test(linea);
    if (!esViñeta) {
      const titulo = linea.replace(/^#+\s*/, "").replace(/[*_:]/g, "").trim();
      if (titulo.length <= 40) {
        if (/hicimos/i.test(titulo)) actual = "hechos";
        else if (/viene|pr[oó]ximos/i.test(titulo)) actual = "proximos";
        else {
          const hit = SECCION_POR_TITULO.find(([re]) => re.test(titulo));
          if (hit) actual = hit[1];
        }
      }
      continue;
    }
    if (!actual) continue;
    const frase = limpiar(linea.replace(/^([-*•]|\d+[.)])\s+/, ""));
    if (!frase || /^\((frase|acción|paso) \d\)$/i.test(frase)) continue;
    if (actual === "hechos") out.hechos.push(frase);
    else if (actual === "proximos") out.proximos.push(frase);
    else (out.insights[actual] ??= []).push(frase);
  }
  return out;
}

/** Solo los insights por servicio (atajo de `parsearRespuesta`). */
export function parsearInsights(texto: string): Partial<Record<SeccionInsight, string[]>> {
  return parsearRespuesta(texto).insights;
}
