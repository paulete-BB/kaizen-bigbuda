import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { sql } from "@/lib/db";
import type { InformeMarketingContenido, InformeSeoContenido } from "@/lib/informes/tipos";

/**
 * Asistencia de IA para el borrador de informes (§3.4, Fase 4: "botón
 * 'generar borrador de insight' que llama a la Anthropic API... propone
 * el resumen y el insight de negocio. Siempre editable; nunca se envía sin
 * revisión humana"). Se ejecuta automáticamente al crear un borrador nuevo
 * (no al duplicar), enganchada en `crearInforme` — nunca bloquea ni rompe
 * la creación del informe si falla o si `ANTHROPIC_API_KEY` no está
 * configurada: degrada a no completar las secciones narrativas, mismo
 * criterio de resiliencia que el pre-llenado de GSC/GA4/Meta (§3.14).
 *
 * Alcance deliberado: genera todo el contenido narrativo salvo dos
 * secciones — `resultadosNumeros.cifras` (SEO) y `antesDespues` (SEO) —
 * porque ambas piden cifras/textos "antes vs. después" puntuales (un
 * título de página real antes y después, un número base al inicio del
 * contrato) que esta plataforma no captura sistemáticamente en ningún
 * lado; pedirle a la IA que las complete de todas formas sería fabricar
 * datos concretos para un informe de cliente. Quedan en blanco, igual que
 * antes, para que el equipo las complete a mano si tiene el dato real.
 *
 * Grounding: `obtenerBitacoraCompleta` trae toda la bitácora real del
 * cliente en el período (`log_entries` — optimizaciones, informes
 * enviados, descuentos, onboarding, avances del bloque de miércoles, no
 * solo `optimizations.resumen`) más las reuniones con el cliente ya
 * realizadas y sus notas (`meetings`) — pedido explícito del usuario:
 * "en la bitácora estará anotado todo lo que hemos hecho y también están
 * adjuntas las reuniones". Client-wide, no por servicio: ni `log_entries`
 * ni `meetings` se registran por servicio en el modelo de datos.
 */

const MODEL = "claude-opus-5";

function clienteConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const REGLAS_SISTEMA = `Eres redactor senior de contenido para informes de clientes de Bigbuda, una agencia de marketing digital (Santiago · Toronto). El informe ya tiene diseño fijo (fondo oscuro, acento dorado) — la tarea es solo el texto.

Reglas:
- No inventar cifras, nombres, hechos ni resultados que no estén en los datos entregados. Si falta información para una sección, escribir algo breve y genérico basado solo en lo disponible.
- Reutilizar tal cual los números ya calculados que se entregan — no redondear distinto ni inventar otros.
- Los datos entregados incluyen la comparación contra el período anterior: usar esa dirección (subió/bajó/se mantuvo) al armar el insight y las proyecciones — nunca presentar una cifra sin decir hacia dónde va, y nunca inventar una comparación si el dato entregado dice "sin dato del mes anterior".
- Tono de negocio: conectar el trabajo técnico con el resultado para el cliente, no usar jerga sin explicarla.
- Español neutro (Chile), sin voseo — mismo registro que el resto de la plataforma.
- Nunca prometer resultados garantizados en las proyecciones — usar lenguaje prudente ("se espera", "la tendencia sugiere").
- Las notas de reuniones con el cliente son información interna del equipo, no texto para copiar tal cual — usarlas como contexto (qué pidió el cliente, qué se acordó) para que el enfoque y las decisiones del informe tengan sentido, nunca citarlas literalmente ni mencionar que hubo una reunión si el cliente no lo espera ver reflejado así.
- Responder únicamente completando el schema pedido.`;

interface BitacoraCompleta {
  entradas: string;
  reuniones: string;
}

/**
 * Trae toda la bitácora del cliente en el período — no solo los resúmenes
 * de `optimizations` (como hacía antes), sino `log_entries` completo (el
 * espejo interno de §3.3: optimizaciones, informes enviados, descuentos
 * terminados, hitos de onboarding, avances del bloque de miércoles — todo
 * lo que ya escribe el equipo en la bitácora real) más las reuniones con
 * el cliente ya realizadas (§4.2 `meetings`, fuera del brief original)
 * con sus notas — pedido explícito del usuario: "en la bitácora estará
 * anotado todo lo que hemos hecho y también están adjuntas las
 * reuniones". Client-wide, no por servicio — ni `log_entries` ni
 * `meetings` se registran por servicio en el modelo de datos, y el
 * prompt ya le dice a la IA para qué servicio es este informe.
 */
async function obtenerBitacoraCompleta(clientId: string, mes: number, anio: number): Promise<BitacoraCompleta> {
  const [entradasRows, reunionesRows] = await Promise.all([
    sql<{ fecha: string; titulo: string; tipo: string; contenido: string }[]>`
      select creado_en::date as fecha, titulo, tipo, contenido from log_entries
      where client_id = ${clientId}
        and extract(year from creado_en) = ${anio} and extract(month from creado_en) = ${mes}
      order by creado_en
    `,
    sql<{ fecha: string; titulo: string; notas: string }[]>`
      select fecha, titulo, notas from meetings
      where client_id = ${clientId} and estado = 'realizada' and notas is not null and notas != ''
        and extract(year from fecha) = ${anio} and extract(month from fecha) = ${mes}
      order by fecha
    `,
  ]);
  return {
    entradas: entradasRows.map((r) => `- ${r.fecha} [${r.tipo || "Registro"}] ${r.titulo}: ${r.contenido}`).join("\n"),
    reuniones: reunionesRows.map((r) => `- ${r.fecha} — ${r.titulo}: ${r.notas}`).join("\n"),
  };
}

interface ContextoCliente {
  nombre: string;
  empresa: string;
  industria: string | null;
}

async function obtenerContextoCliente(clientId: string): Promise<ContextoCliente | null> {
  const [c] = await sql<ContextoCliente[]>`select nombre, empresa, industria from clients where id = ${clientId}`;
  return c ?? null;
}

const NarrativaSeoSchema = z.object({
  bajada: z.string().describe("Portada: una frase corta (una línea) que resuma el período, la primera impresión del informe. Admite **negrita**."),
  enUnaFrase: z.object({
    principal: z.string().describe("Resumen ejecutivo del período, 1-2 líneas, con palabras clave que se puedan destacar en negrita usando **así**."),
    secundario: z.string().describe("Segunda línea, complementa la primera."),
  }),
  nuestroEnfoque: z.object({
    contexto: z.string().describe("Una línea introduciendo el criterio de trabajo del período (rigor, priorización)."),
    decisiones: z
      .array(z.object({ titulo: z.string(), descripcion: z.string().describe("Justificación breve de una línea.") }))
      .min(3)
      .max(4)
      .describe("Qué se decidió NO hacer o priorizar distinto, y por qué — basado en la bitácora entregada."),
  }),
  loQueDejamosFuncionando: z.object({
    seo: z.array(z.string()).min(2).max(5).describe("Bullets sobre posicionamiento orgánico (\"que Google te elija\")."),
    aeo: z.array(z.string()).min(2).max(5).describe("Bullets sobre presencia en respuestas de IA (\"que la IA te cite\")."),
    geo: z.array(z.string()).min(2).max(5).describe("Bullets sobre presencia local (\"que te ubiquen\")."),
  }),
  detalles: z
    .array(
      z.object({
        titulo: z.string(),
        items: z.array(z.object({ titulo: z.string().describe("La acción."), porque: z.string().describe("Por qué se hizo, en una línea.") })).min(1).max(4),
      }),
    )
    .length(2)
    .describe("Dos grupos de detalle técnico: 'El detalle · SEO y arquitectura' y 'El detalle · Contenido y datos estructurados'."),
  impactoProyectado: z.object({
    horizontes: z
      .array(z.object({ etiqueta: z.string(), titulo: z.string(), descripcion: z.string() }))
      .length(3)
      .describe("Tres horizontes en este orden: Semanas 2-4, Meses 1-3, Meses 3-6."),
    nota: z.string().describe("Una línea final sobre el factor decisivo para que la proyección se cumpla."),
  }),
  hojaDeRuta: z.object({
    pasos: z.array(z.object({ titulo: z.string(), descripcion: z.string() })).min(3).max(5).describe("Próximos pasos numerados, basados en los 'próximos pasos' de la bitácora si los hay."),
  }),
});

const NarrativaMarketingSchema = z.object({
  bajada: z.string().describe("Portada: una frase corta (una línea) que resuma el período, la primera impresión del informe. Admite **negrita**."),
  queMejoramos: z
    .array(z.object({ accion: z.string().describe("En lenguaje de negocio, sin detalle técnico."), efecto: z.string().describe("Qué efecto tuvo o se espera, una línea.") }))
    .min(1)
    .max(5)
    .describe("Reescribe los resúmenes de bitácora entregados como 3-5 acciones en lenguaje de negocio — no inventes acciones nuevas."),
  queProyectamos: z.object({
    queEsperar: z.string().describe("Qué esperar de estas mejoras en el próximo período."),
    insight: z
      .string()
      .describe(
        "El insight destacado de negocio — una frase sólida que conecte las acciones del período con el rendimiento comercial del cliente, usando los números reales entregados.",
      ),
  }),
});

/** Genera las secciones narrativas del informe SEO-AEO-GEO. Nunca lanza — degrada a `{}` si falla o si no hay API key configurada. */
export async function generarNarrativaSeo(
  clientId: string,
  periodoMes: number,
  periodoAnio: number,
  periodoLabel: string,
  prellenado: Partial<InformeSeoContenido>,
): Promise<Partial<InformeSeoContenido>> {
  if (!clienteConfigurado()) return {};
  try {
    const [contexto, bitacora] = await Promise.all([obtenerContextoCliente(clientId), obtenerBitacoraCompleta(clientId, periodoMes, periodoAnio)]);
    if (!contexto) return {};

    // `descripcion` ya trae la comparación vs. mes anterior (prellenarSeoDesdeApis) —
    // sin esto, la IA (y el informe) solo verían una cifra suelta, sin dirección.
    const metricas = prellenado.puntoDePartida?.metricas.length
      ? prellenado.puntoDePartida.metricas.map((m) => `${m.etiqueta}: ${m.valor} (${m.descripcion || "sin comparación"})`).join("; ")
      : "sin datos de Search Console para este período";
    const traficoIA = prellenado.traficoIA
      ? `${prellenado.traficoIA.totalSesiones} sesiones desde fuentes de IA (${prellenado.traficoIA.filas.map((f) => `${f.fuente}: ${f.sesiones}`).join(", ")})`
      : "sin datos de tráfico desde IA para este período";

    const prompt = `Cliente: ${contexto.nombre} (${contexto.empresa}${contexto.industria ? `, rubro ${contexto.industria}` : ""})
Servicio: SEO · AEO · GEO
Período del informe: ${periodoLabel}

Datos reales del período (Search Console / GA4):
${metricas}
Tráfico desde IA: ${traficoIA}

Bitácora del período (todo lo que se hizo y registró):
${bitacora.entradas || "sin registros de bitácora para este período"}

Reuniones con el cliente en el período:
${bitacora.reuniones || "sin reuniones registradas para este período"}

Completar el contenido narrativo del informe (bajada de portada, resumen ejecutivo, enfoque, qué se dejó funcionando, detalle de acciones, impacto proyectado y hoja de ruta) según el schema, usando solo la información entregada arriba.`;

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      system: REGLAS_SISTEMA,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(NarrativaSeoSchema), effort: "high" },
    });
    const parsed = response.parsed_output;
    if (!parsed) return {};

    return {
      portada: { ...(prellenado.portada ?? { chips: [] as string[] }), bajada: parsed.bajada },
      enUnaFrase: parsed.enUnaFrase,
      nuestroEnfoque: { cita: "", citaAutor: "", contexto: parsed.nuestroEnfoque.contexto, decisiones: parsed.nuestroEnfoque.decisiones },
      loQueDejamosFuncionando: {
        columnas: [
          { titulo: "SEO", subtitulo: "Que Google te elija", bullets: parsed.loQueDejamosFuncionando.seo },
          { titulo: "AEO · IA", subtitulo: "Que la IA te cite", bullets: parsed.loQueDejamosFuncionando.aeo },
          { titulo: "GEO", subtitulo: "Que te ubiquen", bullets: parsed.loQueDejamosFuncionando.geo },
        ],
      },
      detalles: parsed.detalles,
      impactoProyectado: parsed.impactoProyectado,
      hojaDeRuta: parsed.hojaDeRuta,
    };
  } catch {
    return {};
  }
}

/** Genera las secciones narrativas del informe de Ads (Meta/Google). Nunca lanza — degrada a `{}` si falla o si no hay API key configurada. */
export async function generarNarrativaMarketing(
  clientId: string,
  periodoMes: number,
  periodoAnio: number,
  periodoLabel: string,
  servicioLabel: string,
  prellenado: Partial<InformeMarketingContenido>,
): Promise<Partial<InformeMarketingContenido>> {
  if (!clienteConfigurado()) return {};
  try {
    const [contexto, bitacora] = await Promise.all([obtenerContextoCliente(clientId), obtenerBitacoraCompleta(clientId, periodoMes, periodoAnio)]);
    if (!contexto || (!bitacora.entradas && !bitacora.reuniones)) return {};

    const cifras = prellenado.comoVamosCifras?.metricas.length
      ? prellenado.comoVamosCifras.metricas.map((m) => `${m.etiqueta}: ${m.valor} (${m.deltaDireccion === "up" ? "+" : "-"}${m.deltaTexto} vs. mes anterior)`).join("; ")
      : "sin datos de campañas para este período";

    const prompt = `Cliente: ${contexto.nombre} (${contexto.empresa}${contexto.industria ? `, rubro ${contexto.industria}` : ""})
Servicio: ${servicioLabel}
Período del informe: ${periodoLabel}

Cifras reales del período:
${cifras}

Bitácora del período (todo lo que se hizo y registró):
${bitacora.entradas || "sin registros de bitácora para este período"}

Reuniones con el cliente en el período:
${bitacora.reuniones || "sin reuniones registradas para este período"}

Completar la bajada de portada, "¿Qué mejoramos?" (reescribir la bitácora en lenguaje de negocio) y "¿Qué proyectamos?" (qué esperar + el insight de negocio) según el schema, usando solo la información entregada arriba.`;

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: REGLAS_SISTEMA,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(NarrativaMarketingSchema), effort: "high" },
    });
    const parsed = response.parsed_output;
    if (!parsed) return {};

    return {
      portada: { ...(prellenado.portada ?? { chips: [] as string[] }), bajada: parsed.bajada },
      queMejoramos: { acciones: parsed.queMejoramos },
      queProyectamos: parsed.queProyectamos,
    };
  } catch {
    return {};
  }
}
