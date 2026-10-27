import { sql } from "@/lib/db";
import { addDaysIso, fmtFecha, hoySantiago, toIso } from "@/lib/dates";
import { obtenerCampanasMeta, obtenerResumenMeta } from "@/lib/meta/client";
import { obtenerCampanasMetaGA4, obtenerCampanasPagadoGA4, obtenerTraficoPagadoGA4 } from "@/lib/google/ga4";
import { cargarHistorial, formatearHistorial, HISTORIAL_INICIAL, MIN_HISTORIAL, pendientesHeredados, type DatosSesion } from "@/lib/agente/contexto";

/**
 * Briefing del modo manual: el mismo contexto que recibe el agente integrado
 * (historial, pendientes en espera, pacing, aprobaciones, bitácora, reuniones)
 * más las cifras de la cuenta que Kaizen ya sabe traer, todo en un texto para
 * pegar en Claude. No usa la API de Anthropic. Se arma al abrir la pantalla,
 * así los datos siempre están al día. Las cifras en vivo son de mejor
 * esfuerzo: si una API falla, se avisa y el resto del briefing sigue igual.
 */

const MAX_CARACTERES_DATOS = 9000;

async function seguro<T>(etiqueta: string, f: () => Promise<T>): Promise<string> {
  try {
    const json = JSON.stringify(await f());
    return `### ${etiqueta}\n${json.length > MAX_CARACTERES_DATOS ? json.slice(0, MAX_CARACTERES_DATOS) + " …(truncado)" : json}`;
  } catch (e) {
    return `### ${etiqueta}\n(no disponible: ${e instanceof Error ? e.message : String(e)})`;
  }
}

async function cifrasCuenta(datos: DatosSesion, desde: string, hasta: string): Promise<string> {
  const rango = `${desde} a ${hasta}`;
  if (datos.tipo === "meta_ads") {
    const partes: string[] = [];
    if (datos.metaAdAccountId) {
      const cfg = { adAccountId: datos.metaAdAccountId, metaTokenKey: datos.metaTokenKey };
      partes.push(await seguro(`Meta · resumen de la cuenta (${rango})`, () => obtenerResumenMeta(cfg, desde, hasta)));
      partes.push(await seguro(`Meta · campañas (${rango}; "resultados" es el criterio propio de Meta)`, () => obtenerCampanasMeta(cfg, desde, hasta, 30)));
    } else partes.push("### Meta\n(el cliente no tiene Meta Ad Account ID en su ficha)");
    if (datos.ga4PropertyId) {
      const ga4 = datos.ga4PropertyId;
      partes.push(await seguro(`GA4 · conversiones reales del sitio por campaña, canal Paid Social (${rango}). Esta es la conversión que la agencia considera de verdad; el nombre de campaña puede venir como ID`, () => obtenerCampanasMetaGA4(ga4, desde, hasta, 30)));
    } else partes.push("### GA4\n(sin GA4 configurado para este servicio)");
    return partes.join("\n\n");
  }
  if (!datos.ga4PropertyId) return "### Google Ads vía GA4\n(el cliente no tiene el GA4 de la landing de Google Ads configurado)";
  const ga4 = datos.ga4PropertyId;
  return [
    await seguro(`GA4 · tráfico pagado de Google Ads (${rango}). OJO: puede diferir de lo que muestra Google Ads (otra atribución); el número oficial está en Google Ads`, () => obtenerTraficoPagadoGA4(ga4, desde, hasta)),
    await seguro(`GA4 · campañas de Google Ads (${rango})`, () => obtenerCampanasPagadoGA4(ga4, desde, hasta, 30)),
  ].join("\n\n");
}

export async function construirBriefingManual(datos: DatosSesion): Promise<string> {
  const canal = datos.tipo === "meta_ads" ? "Meta Ads" : "Google Ads";
  const hoy = toIso(hoySantiago());
  const desde = addDaysIso(hoy, -14);
  const hasta = addDaysIso(hoy, -1);

  const historial = await cargarHistorial(datos.serviceId, datos.optimizationId, HISTORIAL_INICIAL);

  const [pacing] = await sql<{ presupuesto: number; moneda: string; gasto_acumulado: number; pacing_pct: number | null }[]>`
    select presupuesto, moneda, gasto_acumulado, pacing_pct from budgets
    where service_id = ${datos.serviceId}
      and mes = extract(month from now() at time zone 'America/Santiago') and anio = extract(year from now() at time zone 'America/Santiago')
  `;
  const aprobaciones = await sql<{ tipo: string; descripcion: string; enviado_en: string; estado_efectivo: string }[]>`
    select tipo, descripcion, enviado_en, estado_efectivo from approvals_view
    where client_id = ${datos.clientId} and estado_efectivo in ('enviado', 'sin_respuesta') order by enviado_en
  `;
  const bitacora = await sql<{ fecha: string; titulo: string; contenido: string }[]>`
    select creado_en::date as fecha, titulo, contenido from log_entries
    where client_id = ${datos.clientId} and creado_en >= now() - interval '30 days' order by creado_en desc limit 15
  `;
  const reuniones = await sql<{ fecha: string; titulo: string; notas: string }[]>`
    select fecha, titulo, notas from meetings
    where client_id = ${datos.clientId} and estado = 'realizada' and coalesce(notas, '') != '' and fecha >= current_date - 30
    order by fecha desc limit 5
  `;
  const cifras = await cifrasCuenta(datos, desde, hasta);

  const aviso =
    historial.length < MIN_HISTORIAL
      ? `OJO: solo hay ${historial.length} optimización(es) anterior(es) registrada(s) en Kaizen (lo ideal son al menos ${MIN_HISTORIAL}). Trabaja con lo que haya y dilo en tu respuesta.`
      : "";

  return [
    `# Optimización semanal de ${canal} · ${datos.clienteNombre}`,
    "",
    "Actúa como Paid Media Senior de Bigbuda (usa la skill de paid media si está disponible). Vas a auditar la cuenta, armar un plan priorizado para esta semana y ayudarme a dejarlo listo. Yo ejecuto los cambios; tú propones.",
    "",
    "## Cómo trabajar",
    `1. Abre la cuenta de ${canal} de ${datos.clienteNombre} en el navegador${datos.metaAdAccountId && datos.tipo === "meta_ads" ? ` (cuenta de anuncios de Meta: ${datos.metaAdAccountId})` : ""} y audítala: gasto y pacing, rendimiento por campaña/conjunto/anuncio, creativos fatigados, públicos, segmentaciones, términos de búsqueda (Google) y cambios recientes.`,
    "2. ANTES de proponer nada, revisa abajo el historial y los pendientes: no repitas ni pises acciones que están en espera de más datos (respeta las fechas de revisión) y retoma lo que quedó pendiente.",
    "3. Usa las cifras de Kaizen como contexto. La conversión real del cliente es la de GA4 cuando existe; si lo que ves en la plataforma de anuncios difiere mucho, dilo.",
    "4. Prioriza por impacto en resultados de negocio. No inventes datos: si algo no lo pudiste ver, dilo.",
    "5. Conversa conmigo hasta que el plan esté listo. Cuando te pida cerrar, entrégame la respuesta final en el formato de abajo.",
    "",
    "## Datos del cliente",
    `Industria: ${datos.industria ?? "no indicada"} · Sitio: ${datos.sitioWeb ?? "no indicado"} · Fecha de esta optimización: hoy, ${fmtFecha(hoy)} (estaba programada para ${fmtFecha(datos.fechaProgramada)}, pero cuenta la fecha de ejecución)`,
    "",
    `## Últimas ${historial.length} optimizaciones de este servicio (de la más reciente a la más antigua)`,
    formatearHistorial(historial),
    aviso,
    "",
    "## Pendientes y acciones en espera heredados",
    pendientesHeredados(historial),
    "",
    "## Presupuesto del mes (dato de Kaizen)",
    pacing
      ? `Presupuesto acordado: ${pacing.presupuesto} ${pacing.moneda} · gasto acumulado cargado: ${pacing.gasto_acumulado} · pacing: ${pacing.pacing_pct ?? "s/d"}%`
      : "Sin presupuesto cargado este mes en Kaizen.",
    "",
    "## Aprobaciones del cliente abiertas",
    aprobaciones.length ? aprobaciones.map((a) => `- (${a.estado_efectivo}, desde ${a.enviado_en}) ${a.tipo}: ${a.descripcion}`).join("\n") : "Ninguna.",
    "",
    "## Bitácora del cliente, últimos 30 días",
    bitacora.length ? bitacora.map((b) => `- ${b.fecha} · ${b.titulo}: ${b.contenido.replace(/\s+/g, " ").slice(0, 400)}`).join("\n") : "Sin entradas.",
    "",
    "## Reuniones con el cliente, últimos 30 días (contexto interno, no lo cites en el resumen)",
    reuniones.length ? reuniones.map((r) => `- ${r.fecha} · ${r.titulo}: ${r.notas.replace(/\s+/g, " ").slice(0, 500)}`).join("\n") : "Sin reuniones con notas.",
    "",
    "## Cifras de la cuenta traídas por Kaizen",
    cifras,
    "",
    "## Formato de la respuesta final (respétalo exacto; yo la pego en Kaizen)",
    "## RESUMEN",
    "Texto para la bitácora del cliente: qué se hizo y decidió esta semana, claro y sin relleno, en párrafos cortos o viñetas.",
    "",
    "## HALLAZGOS",
    "Hallazgos relevantes del análisis (opcional).",
    "",
    "## PLAN",
    "Un bloque de código ```json con un arreglo de máximo 12 ítems, de mayor a menor prioridad, incluyendo lo que se deja EN ESPERA de datos (con su fecha de revisión) para que la próxima optimización lo encuentre. Cada ítem:",
    '{"id":"identificador-corto","prioridad":"alta|media|baja","tipo":"accion|esperar_datos|revisar","titulo":"…","detalle":"qué hacer exacto, por qué (con el dato) y cómo medir el efecto","revisarEn":"YYYY-MM-DD (solo para esperar_datos/revisar)"}',
  ].join("\n");
}
