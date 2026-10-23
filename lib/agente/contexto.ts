import { sql } from "@/lib/db";
import { fmtFecha } from "@/lib/dates";
import type { ItemPlan } from "@/lib/agente/tipos";

export const MIN_HISTORIAL = 3;
export const HISTORIAL_INICIAL = 5;

export interface DatosSesion {
  sessionId: string;
  optimizationId: string;
  clientId: string;
  serviceId: string;
  tipo: "meta_ads" | "google_ads";
  clienteNombre: string;
  industria: string | null;
  sitioWeb: string | null;
  fechaProgramada: string;
  metaAdAccountId: string | null;
  metaTokenKey: string | null;
  /** GA4 contra el que se cruzan las conversiones del servicio: la landing dedicada si existe, si no el del sitio (Meta); solo la landing de Google Ads (Google). */
  ga4PropertyId: string | null;
  estado: "en_curso" | "cerrada";
}

export async function cargarDatosSesion(sessionId: string): Promise<DatosSesion | null> {
  const [r] = await sql<
    {
      session_id: string;
      optimization_id: string;
      client_id: string;
      service_id: string;
      tipo: "meta_ads" | "google_ads" | "seo_aeo_geo";
      estado: "en_curso" | "cerrada";
      cliente_nombre: string;
      industria: string | null;
      sitio_web: string | null;
      fecha_programada: string;
      meta_ad_account_id: string | null;
      meta_token_key: string | null;
      ga4_property_id: string | null;
      google_ads_ga4_property_id: string | null;
      meta_ads_ga4_property_id: string | null;
    }[]
  >`
    select s.id as session_id, s.optimization_id, s.client_id, s.service_id, s.estado, o.tipo, o.fecha_programada,
           c.nombre as cliente_nombre, c.industria, c.sitio_web, c.meta_ad_account_id, c.meta_token_key,
           c.ga4_property_id, c.google_ads_ga4_property_id, c.meta_ads_ga4_property_id
    from agent_sessions s
    join optimizations o on o.id = s.optimization_id
    join clients c on c.id = s.client_id
    where s.id = ${sessionId}
  `;
  if (!r || r.tipo === "seo_aeo_geo") return null;
  return {
    sessionId: r.session_id,
    optimizationId: r.optimization_id,
    clientId: r.client_id,
    serviceId: r.service_id,
    tipo: r.tipo,
    clienteNombre: r.cliente_nombre,
    industria: r.industria,
    sitioWeb: r.sitio_web,
    fechaProgramada: r.fecha_programada,
    metaAdAccountId: r.meta_ad_account_id,
    metaTokenKey: r.meta_token_key,
    ga4PropertyId: r.tipo === "meta_ads" ? r.meta_ads_ga4_property_id ?? r.ga4_property_id : r.google_ads_ga4_property_id,
    estado: r.estado,
  };
}

export interface OptimizacionPasada {
  id: string;
  fechaRealizada: string | null;
  responsable: string | null;
  resumen: string | null;
  hallazgos: string | null;
  proximosPasos: string | null;
  plan: ItemPlan[];
}

/** Últimas optimizaciones ya realizadas del mismo servicio (no la actual), con el plan que dejó el agente en cada una. */
export async function cargarHistorial(serviceId: string, excluirOptimizationId: string, limite: number): Promise<OptimizacionPasada[]> {
  const rows = await sql<
    { id: string; fecha_realizada: string | null; responsable: string | null; resumen: string | null; hallazgos: string | null; proximos_pasos: string | null; plan: ItemPlan[] | null }[]
  >`
    select o.id, o.fecha_realizada, u.nombre as responsable, o.resumen, o.hallazgos, o.proximos_pasos, s.plan
    from optimizations o
    left join users u on u.id = o.responsable_id
    left join agent_sessions s on s.optimization_id = o.id
    where o.service_id = ${serviceId} and o.estado = 'realizada' and o.id != ${excluirOptimizationId}
    order by o.fecha_realizada desc nulls last, o.creado_en desc
    limit ${limite}
  `;
  return rows.map((r) => ({
    id: r.id,
    fechaRealizada: r.fecha_realizada,
    responsable: r.responsable,
    resumen: r.resumen,
    hallazgos: r.hallazgos,
    proximosPasos: r.proximos_pasos,
    plan: r.plan ?? [],
  }));
}

export function formatearHistorial(historial: OptimizacionPasada[]): string {
  if (historial.length === 0) return "No hay optimizaciones anteriores registradas para este servicio (es la primera).";
  const bloques = historial.map((h, i) => {
    const lineas = [`### ${i + 1}. ${h.fechaRealizada ? fmtFecha(h.fechaRealizada) : "sin fecha"}${h.responsable ? ` · ${h.responsable}` : ""}`];
    lineas.push(`Resumen: ${h.resumen?.trim() || "(sin resumen)"}`);
    if (h.hallazgos?.trim()) lineas.push(`Hallazgos: ${h.hallazgos.trim()}`);
    if (h.proximosPasos?.trim()) lineas.push(`Próximos pasos / en espera: ${h.proximosPasos.trim()}`);
    if (h.plan.length > 0) {
      lineas.push("Plan de esa sesión:");
      for (const it of h.plan) {
        const hasta = it.revisarEn ? ` (revisar desde ${it.revisarEn})` : "";
        lineas.push(`- [${it.estado}] (${it.prioridad}, ${it.tipo}) ${it.titulo}${hasta}: ${it.detalle}`);
      }
    }
    return lineas.join("\n");
  });
  return bloques.join("\n\n");
}

/** Ítems de planes anteriores que quedaron sin resolver — se destacan aparte para que el agente no los pase por alto. */
export function pendientesHeredados(historial: OptimizacionPasada[]): string {
  const filas: string[] = [];
  for (const h of historial) {
    for (const it of h.plan) {
      if (it.estado !== "pendiente") continue;
      const hasta = it.revisarEn ? ` — no evaluar antes del ${it.revisarEn}` : "";
      filas.push(`- (${h.fechaRealizada ?? "s/f"}, ${it.tipo}, ${it.prioridad}) ${it.titulo}${hasta}: ${it.detalle}`);
    }
  }
  return filas.length ? filas.join("\n") : "Ninguno registrado en los planes estructurados anteriores (revisa igual los 'Próximos pasos' de texto libre).";
}

export async function construirMensajeInicial(datos: DatosSesion): Promise<string> {
  const historial = await cargarHistorial(datos.serviceId, datos.optimizationId, HISTORIAL_INICIAL);
  const canal = datos.tipo === "meta_ads" ? "Meta Ads" : "Google Ads";
  const aviso =
    historial.length < MIN_HISTORIAL
      ? `\nOJO: solo hay ${historial.length} optimización(es) anterior(es) registrada(s) (se esperan al menos ${MIN_HISTORIAL}). Dilo en tu primer mensaje y trabaja con lo que haya.`
      : "";
  return [
    `Inicia la optimización semanal de ${canal} del cliente "${datos.clienteNombre}".`,
    `Industria: ${datos.industria ?? "no indicada"} · Sitio: ${datos.sitioWeb ?? "no indicado"} · Fecha programada: ${datos.fechaProgramada}.`,
    "",
    `## Últimas ${historial.length} optimizaciones de este servicio (de la más reciente a la más antigua)`,
    formatearHistorial(historial),
    aviso,
    "",
    "## Pendientes y acciones en espera heredados",
    pendientesHeredados(historial),
    "",
    "Primero resume en pocas líneas qué hay pendiente o en espera según este historial. Después audita la cuenta con tus herramientas y guarda el plan priorizado de la semana.",
  ].join("\n");
}
