import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sql } from "@/lib/db";
import { obtenerCampanasMeta, obtenerResumenMeta, obtenerSerieDiariaMeta, type ConfigMeta } from "@/lib/meta/client";
import { obtenerCampanasMetaGA4, obtenerCampanasPagadoGA4, obtenerTraficoPagadoDiarioGA4, obtenerTraficoPagadoGA4 } from "@/lib/google/ga4";
import { cargarHistorial, formatearHistorial, type DatosSesion } from "@/lib/agente/contexto";
import type { EventoAgente, ItemPlan } from "@/lib/agente/tipos";

/**
 * Herramientas del agente de optimización (Fase 1: solo lectura de la
 * cuenta + dos herramientas internas para guardar el plan y el resumen).
 * Ninguna escribe en Meta/Google — el equipo ejecuta las acciones del plan
 * a mano. Los resultados se devuelven como JSON acotado en tamaño para no
 * inflar el contexto de la conversación.
 */

const MAX_CARACTERES_RESULTADO = 14000;
const MAX_DIAS_RANGO = 120;

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD");

const Rango = z
  .object({ desde: Fecha.describe("Inicio del rango (YYYY-MM-DD)."), hasta: Fecha.describe("Fin del rango, inclusive (YYYY-MM-DD).") })
  .refine((r) => r.desde <= r.hasta, "desde debe ser anterior o igual a hasta")
  .refine((r) => (Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000 <= MAX_DIAS_RANGO, `el rango no puede superar ${MAX_DIAS_RANGO} días`);

const SinParametros = z.object({});

const HistorialInput = z.object({ limite: z.number().int().min(1).max(10).optional().describe("Cuántas optimizaciones anteriores traer (por defecto 5, máximo 10).") });
const BitacoraInput = z.object({ dias: z.number().int().min(1).max(90).optional().describe("Ventana en días hacia atrás (por defecto 30).") });

const ItemPlanInput = z.object({
  id: z.string().min(1).max(40).describe("Identificador corto y estable del ítem (ej. 'pausar-anuncio-x'). Reutiliza el mismo id si el ítem ya existía en el plan."),
  prioridad: z.enum(["alta", "media", "baja"]),
  tipo: z.enum(["accion", "esperar_datos", "revisar"]).describe("accion = hay que hacerla esta semana; esperar_datos = se deja como está hasta tener más datos; revisar = chequeo puntual."),
  titulo: z.string().min(3).max(140),
  detalle: z.string().min(3).max(1200).describe("Qué hacer exactamente (campaña/conjunto/anuncio, cambio y magnitud), por qué (con el dato que lo respalda) y cómo medir el efecto."),
  revisarEn: Fecha.optional().describe("Para esperar_datos/revisar: fecha desde la cual se puede volver a evaluar."),
});
const PlanInput = z.object({ items: z.array(ItemPlanInput).min(1).max(12) });

const ResumenInput = z.object({
  resumen: z.string().min(10).describe("Resumen de la optimización listo para la bitácora: qué se hizo/decidió esta semana, en lenguaje claro, sin relleno."),
  hallazgos: z.string().optional().describe("Hallazgos relevantes del análisis (opcional)."),
});

interface DefHerramienta {
  nombre: string;
  descripcion: string;
  schema: z.ZodType;
  /** Servicios para los que aplica (todas las internas aplican a ambos). */
  tipos: ("meta_ads" | "google_ads")[];
}

const DEFINICIONES: DefHerramienta[] = [
  {
    nombre: "historial_optimizaciones",
    descripcion: "Trae las optimizaciones anteriores ya realizadas de este servicio (resumen, hallazgos, próximos pasos y el plan de cada sesión con el estado de cada ítem). Úsala si necesitas más historia que la entregada al inicio.",
    schema: HistorialInput,
    tipos: ["meta_ads", "google_ads"],
  },
  {
    nombre: "bitacora_reciente",
    descripcion: "Entradas recientes de la bitácora del cliente (todo el trabajo registrado, no solo de este servicio) y notas de reuniones realizadas.",
    schema: BitacoraInput,
    tipos: ["meta_ads", "google_ads"],
  },
  {
    nombre: "pacing_presupuesto",
    descripcion: "Presupuesto mensual acordado, gasto acumulado cargado y pacing del mes en curso para este servicio. Es el dato manual de la plataforma: contrástalo con el gasto real de la cuenta.",
    schema: SinParametros,
    tipos: ["meta_ads", "google_ads"],
  },
  {
    nombre: "aprobaciones_abiertas",
    descripcion: "Aprobaciones del cliente pendientes o sin respuesta (pueden estar bloqueando acciones).",
    schema: SinParametros,
    tipos: ["meta_ads", "google_ads"],
  },
  {
    nombre: "meta_resumen_cuenta",
    descripcion: "Resumen de la cuenta de Meta Ads en un rango: gasto, impresiones, clics, CTR, CPC, CPM, alcance, resultados y moneda.",
    schema: Rango,
    tipos: ["meta_ads"],
  },
  {
    nombre: "meta_campanas",
    descripcion: "Campañas de Meta Ads en un rango: gasto, impresiones, clics, CTR, CPC, resultados (criterio propio de Meta) y si es campaña de mensajes. Incluye el ID de campaña.",
    schema: Rango,
    tipos: ["meta_ads"],
  },
  {
    nombre: "meta_serie_diaria",
    descripcion: "Serie diaria de gasto, clics, impresiones y resultados de la cuenta de Meta Ads en un rango. Útil para ver tendencias y efecto de cambios recientes.",
    schema: Rango,
    tipos: ["meta_ads"],
  },
  {
    nombre: "ga4_conversiones_paid_social",
    descripcion: "Conversiones reales del sitio por campaña para el tráfico de Meta (GA4, canal Paid Social). Es la conversión que la agencia considera de verdad. El nombre de campaña en GA4 puede ser el nombre o el ID de la campaña de Meta; no aplica a campañas de mensajes.",
    schema: Rango,
    tipos: ["meta_ads"],
  },
  {
    nombre: "google_ads_resumen_ga4",
    descripcion: "Tráfico pagado de Google Ads medido en GA4 (sessionSource google y sessionMedium cpc; si las campañas salen sin nombre es porque GA4 no recibe el nombre: falta vincular Ads↔GA4 o el utm_campaign): sesiones, conversiones y costo. LIMITACIÓN: no hay API de Google Ads conectada; GA4 puede diferir del número que muestra Google Ads (atribución distinta) y el costo requiere vinculación Ads↔GA4.",
    schema: Rango,
    tipos: ["google_ads"],
  },
  {
    nombre: "google_ads_campanas_ga4",
    descripcion: "Desglose por campaña del tráfico pagado de Google Ads en GA4 (sesiones, conversiones, costo). Misma limitación que google_ads_resumen_ga4.",
    schema: Rango,
    tipos: ["google_ads"],
  },
  {
    nombre: "google_ads_serie_diaria_ga4",
    descripcion: "Serie diaria del tráfico pagado de Google Ads en GA4 (sesiones, conversiones, costo). Misma limitación que google_ads_resumen_ga4.",
    schema: Rango,
    tipos: ["google_ads"],
  },
  {
    nombre: "guardar_plan",
    descripcion:
      "Guarda (reemplaza) el plan priorizado de la semana que ve el usuario en su panel. Llámala cuando termines la auditoría y cada vez que el usuario pida ajustar el plan. Incluye también los ítems 'esperar_datos' (acciones que NO se deben tocar todavía, con la fecha de revisión) para que queden registrados. Máximo 12 ítems, ordenados de mayor a menor prioridad.",
    schema: PlanInput,
    tipos: ["meta_ads", "google_ads"],
  },
  {
    nombre: "guardar_resumen",
    descripcion:
      "Guarda el borrador del resumen de la optimización, que el usuario revisará y que se escribirá en la bitácora al cerrar. Llámala cuando el usuario pida cerrar o cuando el plan esté listo y ejecutado; vuelve a llamarla si el usuario pide cambios.",
    schema: ResumenInput,
    tipos: ["meta_ads", "google_ads"],
  },
];

export function herramientasPara(tipo: "meta_ads" | "google_ads"): Anthropic.Tool[] {
  return DEFINICIONES.filter((d) => d.tipos.includes(tipo)).map((d) => {
    const { $schema: _omit, ...inputSchema } = z.toJSONSchema(d.schema) as Record<string, unknown>;
    void _omit;
    return { name: d.nombre, description: d.descripcion, input_schema: inputSchema as Anthropic.Tool.InputSchema };
  });
}

export interface ContextoEjecucion {
  datos: DatosSesion;
  emitir: (e: EventoAgente) => void;
}

function acotar(valor: unknown): string {
  const json = JSON.stringify(valor);
  if (json.length <= MAX_CARACTERES_RESULTADO) return json;
  return JSON.stringify({ aviso: `Resultado truncado a ${MAX_CARACTERES_RESULTADO} caracteres; pide un rango más corto.`, parcial: json.slice(0, MAX_CARACTERES_RESULTADO) });
}

function configMeta(datos: DatosSesion): ConfigMeta {
  if (!datos.metaAdAccountId) throw new Error("El cliente no tiene Meta Ad Account ID configurado en su ficha.");
  return { adAccountId: datos.metaAdAccountId, metaTokenKey: datos.metaTokenKey };
}

function exigirGa4(datos: DatosSesion): string {
  if (!datos.ga4PropertyId) {
    throw new Error(
      datos.tipo === "meta_ads"
        ? "El cliente no tiene GA4 Property ID configurado (ni del sitio ni de la landing de Meta Ads)."
        : "El cliente no tiene GA4 Property ID de la landing de Google Ads configurado en su ficha.",
    );
  }
  return datos.ga4PropertyId;
}

async function ejecutarInterna(nombre: string, input: unknown, ctx: ContextoEjecucion): Promise<unknown> {
  const { datos } = ctx;
  switch (nombre) {
    case "historial_optimizaciones": {
      const { limite } = HistorialInput.parse(input);
      const historial = await cargarHistorial(datos.serviceId, datos.optimizationId, limite ?? 5);
      return { cantidad: historial.length, historial: formatearHistorial(historial) };
    }
    case "bitacora_reciente": {
      const { dias } = BitacoraInput.parse(input);
      const ventana = dias ?? 30;
      const [entradas, reuniones] = await Promise.all([
        sql<{ fecha: string; tipo: string; titulo: string; contenido: string }[]>`
          select creado_en::date as fecha, tipo, titulo, contenido from log_entries
          where client_id = ${datos.clientId} and creado_en >= now() - make_interval(days => ${ventana})
          order by creado_en desc limit 40
        `,
        sql<{ fecha: string; titulo: string; notas: string }[]>`
          select fecha, titulo, notas from meetings
          where client_id = ${datos.clientId} and estado = 'realizada' and notas is not null and notas != ''
            and fecha >= current_date - ${ventana}::int
          order by fecha desc limit 10
        `,
      ]);
      return { entradas, reuniones };
    }
    case "pacing_presupuesto": {
      const [b] = await sql<
        { mes: number; anio: number; presupuesto: number; moneda: string; gasto_acumulado: number; pacing_pct: number | null; actualizado_en: string }[]
      >`
        select mes, anio, presupuesto, moneda, gasto_acumulado, pacing_pct, actualizado_en::date as actualizado_en from budgets
        where service_id = ${datos.serviceId}
          and mes = extract(month from now() at time zone 'America/Santiago') and anio = extract(year from now() at time zone 'America/Santiago')
      `;
      return b ?? { aviso: "Sin presupuesto cargado para este mes en la plataforma." };
    }
    case "aprobaciones_abiertas": {
      const filas = await sql<{ tipo: string; descripcion: string; enviado_en: string; estado_efectivo: string; optimization_id: string | null }[]>`
        select tipo, descripcion, enviado_en, estado_efectivo, optimization_id from approvals_view
        where client_id = ${datos.clientId} and estado_efectivo in ('enviado', 'sin_respuesta')
        order by enviado_en
      `;
      return { cantidad: filas.length, aprobaciones: filas };
    }
    case "meta_resumen_cuenta": {
      const r = Rango.parse(input);
      return obtenerResumenMeta(configMeta(datos), r.desde, r.hasta);
    }
    case "meta_campanas": {
      const r = Rango.parse(input);
      return obtenerCampanasMeta(configMeta(datos), r.desde, r.hasta, 30);
    }
    case "meta_serie_diaria": {
      const r = Rango.parse(input);
      return obtenerSerieDiariaMeta(configMeta(datos), r.desde, r.hasta);
    }
    case "ga4_conversiones_paid_social": {
      const r = Rango.parse(input);
      return obtenerCampanasMetaGA4(exigirGa4(datos), r.desde, r.hasta, 30);
    }
    case "google_ads_resumen_ga4": {
      const r = Rango.parse(input);
      return obtenerTraficoPagadoGA4(exigirGa4(datos), r.desde, r.hasta);
    }
    case "google_ads_campanas_ga4": {
      const r = Rango.parse(input);
      return obtenerCampanasPagadoGA4(exigirGa4(datos), r.desde, r.hasta, 30);
    }
    case "google_ads_serie_diaria_ga4": {
      const r = Rango.parse(input);
      return obtenerTraficoPagadoDiarioGA4(exigirGa4(datos), r.desde, r.hasta);
    }
    case "guardar_plan": {
      const { items } = PlanInput.parse(input);
      const [actual] = await sql<{ plan: ItemPlan[] }[]>`select plan from agent_sessions where id = ${datos.sessionId}`;
      const estadoPrevio = new Map((actual?.plan ?? []).map((it) => [it.id, it.estado]));
      const vistos = new Set<string>();
      const plan: ItemPlan[] = [];
      for (const it of items) {
        if (vistos.has(it.id)) continue;
        vistos.add(it.id);
        plan.push({ ...it, revisarEn: it.revisarEn ?? null, estado: estadoPrevio.get(it.id) ?? "pendiente" });
      }
      await sql`update agent_sessions set plan = ${sql.json(plan as never)}, actualizado_en = now() where id = ${datos.sessionId}`;
      ctx.emitir({ type: "plan", plan });
      return { ok: true, items: plan.length };
    }
    case "guardar_resumen": {
      const r = ResumenInput.parse(input);
      await sql`
        update agent_sessions set resumen_borrador = ${r.resumen}, hallazgos_borrador = ${r.hallazgos ?? null}, actualizado_en = now()
        where id = ${datos.sessionId}
      `;
      ctx.emitir({ type: "resumen", resumen: r.resumen, hallazgos: r.hallazgos ?? "" });
      return { ok: true };
    }
    default:
      throw new Error(`Herramienta desconocida: ${nombre}`);
  }
}

/** Ejecuta una herramienta y devuelve el texto del tool_result. Los errores vuelven como resultado (is_error) para que el agente los reporte, nunca rompen el turno. */
export async function ejecutarHerramienta(nombre: string, input: unknown, ctx: ContextoEjecucion): Promise<{ contenido: string; esError: boolean }> {
  const def = DEFINICIONES.find((d) => d.nombre === nombre);
  if (!def || !def.tipos.includes(ctx.datos.tipo)) return { contenido: `Herramienta no disponible: ${nombre}`, esError: true };
  ctx.emitir({ type: "herramienta", nombre, estado: "inicio" });
  try {
    const resultado = await ejecutarInterna(nombre, input, ctx);
    ctx.emitir({ type: "herramienta", nombre, estado: "fin" });
    return { contenido: acotar(resultado), esError: false };
  } catch (e) {
    ctx.emitir({ type: "herramienta", nombre, estado: "error" });
    const mensaje = e instanceof z.ZodError ? `Parámetros inválidos: ${e.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ")}` : e instanceof Error ? e.message : String(e);
    return { contenido: `Error: ${mensaje}`, esError: true };
  }
}
