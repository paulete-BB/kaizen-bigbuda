import { sql } from "@/lib/db";
import { hoySantiago, toIso } from "@/lib/dates";
import { getSettings } from "@/lib/data/settings";

/**
 * Datos de la pantalla de inicio "Mi día" (cola de trabajo de la persona
 * logueada) y de la pestaña "Cartera" (todos los servicios de Ads del equipo).
 * Todo sale de Postgres: los números de "ayer" son los snapshots que guardan
 * los crons, nunca una llamada en vivo a Meta/Google por carga (mismo criterio
 * que el resto del dashboard tras el bug de fan-out). Consultas secuenciales,
 * no `Promise.all`, por el pooler de Supabase.
 *
 * SEO queda fuera a propósito: las optimizaciones de posicionamiento no se
 * llevan en Kaizen (`OPTIMIZACIONES_SEO_EN_KAIZEN`).
 */

export type Semaforo = "rojo" | "ambar" | "verde";

export interface MotivoFila {
  texto: string;
  /** "rojo" = hay que mirar la cuenta ya; "ambar" = pendiente o dato a vigilar. */
  nivel: "rojo" | "ambar";
}

export interface FilaAds {
  /** Id de la optimización de la semana (null en la cartera si el servicio no tiene una abierta). */
  optimizationId: string | null;
  clienteId: string;
  clienteNombre: string;
  servicioTipo: "meta_ads" | "google_ads";
  responsable: string | null;
  /** Fecha programada de la optimización abierta más antigua (null si no hay). */
  fechaProgramada: string | null;
  /** Días de atraso respecto de hoy (0 = es de hoy o no tiene una abierta). */
  diasAtraso: number;
  semaforo: Semaforo;
  motivos: MotivoFila[];
  ayer: { fecha: string; gasto: number | null; conversiones: number | null; cpa: number | null } | null;
  /** Lo que quedó abierto en la última optimización realizada de este servicio. */
  pendientes: string | null;
  ultimaOptimizacion: string | null;
  /** "en_curso" si ya se empezó la optimización con el briefing. */
  agenteEstado: "en_curso" | "cerrada" | null;
  /** Aprobaciones sin respuesta del cliente. */
  aprobacionesSinRespuesta: number;
  /** La optimización está bloqueada o el cliente tiene una aprobación sin respuesta. */
  conAprobacionPendiente: boolean;
}

export interface MiDiaData {
  hoyIso: string;
  usuarioNombre: string;
  resumen: { hoy: number; atrasadas: number; enRiesgo: number; bloqueadas: number };
  /** Hoy y atrasadas, de la más atrasada a la de hoy. Las que están al día no aparecen. */
  cola: FilaAds[];
  /** Lo que le toca esta semana a la persona (después de hoy). */
  semana: { optimizationId: string; clienteId: string; clienteNombre: string; servicioTipo: string; fecha: string }[];
}

export const SERVICIO_ADS_LABEL: Record<string, string> = { meta_ads: "Meta Ads", google_ads: "Google Ads" };

interface ServicioBase {
  service_id: string;
  tipo: "meta_ads" | "google_ads";
  cliente_id: string;
  cliente_nombre: string;
}

interface Snap {
  service_id: string;
  periodo_inicio: string;
  gasto: string | null;
  conversiones: string | null;
  cpa: string | null;
}

function diasEntre(desdeIso: string, hastaIso: string): number {
  const [a, b] = [desdeIso, hastaIso].map((s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))));
  return Math.round((b - a) / 86_400_000);
}

/** Datos de apoyo (ayer, pacing, aprobaciones, pendientes) para un conjunto de servicios de Ads. */
async function apoyoPorServicio(servicios: ServicioBase[], hoy: Date) {
  const serviceIds = servicios.map((s) => s.service_id);
  const clientIds = [...new Set(servicios.map((s) => s.cliente_id))];
  const settings = await getSettings();
  if (serviceIds.length === 0) {
    return { snaps: new Map<string, Snap>(), pacing: new Map<string, number>(), aprobaciones: new Map<string, { n: number; dias: number }>(), pendientes: new Map<string, { pendientes: string | null; fecha: string | null }>(), umbral: settings.umbralPacingPct };
  }

  // Snapshot "de un solo día" más reciente por servicio (lo guarda el cron de "ayer").
  const snapRows = await sql<Snap[]>`
    select s.id as service_id, ms.periodo_inicio,
           coalesce(ms.datos_json->>'gasto', ms.datos_json->>'costo') as gasto,
           coalesce(ms.datos_json->>'resultados', ms.datos_json->>'conversiones') as conversiones,
           ms.datos_json->>'cpa' as cpa
    from services s
    join lateral (
      select datos_json, periodo_inicio from metric_snapshots m
      where m.service_id = s.id and m.periodo_inicio = m.periodo_fin
      order by m.obtenido_en desc limit 1
    ) ms on true
    where s.id = any(${serviceIds}::uuid[])
  `;

  const pacingRows = await sql<{ service_id: string; pacing_pct: string }[]>`
    select service_id, pacing_pct from budgets
    where service_id = any(${serviceIds}::uuid[]) and mes = ${hoy.getMonth() + 1} and anio = ${hoy.getFullYear()} and pacing_pct is not null
  `;

  const aprobRows = await sql<{ client_id: string; n: string; mas_antigua: string }[]>`
    select client_id, count(*) as n, min(enviado_en)::date as mas_antigua
    from approvals_view
    where estado_efectivo = 'sin_respuesta' and client_id = any(${clientIds}::uuid[])
    group by client_id
  `;

  const pendRows = await sql<{ service_id: string; proximos_pasos: string | null; fecha_realizada: string | null }[]>`
    select distinct on (service_id) service_id, proximos_pasos, fecha_realizada
    from optimizations
    where service_id = any(${serviceIds}::uuid[]) and estado = 'realizada'
    order by service_id, fecha_realizada desc nulls last
  `;

  const hoyIso = toIso(hoy);
  return {
    snaps: new Map(snapRows.map((r) => [r.service_id, r])),
    pacing: new Map(pacingRows.map((r) => [r.service_id, Number(r.pacing_pct)])),
    aprobaciones: new Map(aprobRows.map((r) => [r.client_id, { n: Number(r.n), dias: diasEntre(r.mas_antigua, hoyIso) }])),
    pendientes: new Map(pendRows.map((r) => [r.service_id, { pendientes: r.proximos_pasos?.trim() || null, fecha: r.fecha_realizada }])),
    umbral: settings.umbralPacingPct,
  };
}

function armarFila(
  base: ServicioBase & {
    optimization_id: string | null;
    fecha_programada: string | null;
    estado: string | null;
    bloqueada_motivo: string | null;
    responsable: string | null;
    agente_estado: "en_curso" | "cerrada" | null;
    abiertas?: number;
  },
  apoyo: Awaited<ReturnType<typeof apoyoPorServicio>>,
  hoyIso: string,
): FilaAds {
  const motivos: MotivoFila[] = [];
  const diasAtraso = base.fecha_programada ? Math.max(0, diasEntre(base.fecha_programada, hoyIso)) : 0;
  const snap = apoyo.snaps.get(base.service_id);
  const conversiones = snap?.conversiones != null ? Number(snap.conversiones) : null;
  const gasto = snap?.gasto != null ? Number(snap.gasto) : null;

  // Regla de riesgo definida por el equipo: sin conversiones ayer.
  if (snap && conversiones === 0) motivos.push({ texto: "Sin conversiones ayer", nivel: "rojo" });

  const pacing = apoyo.pacing.get(base.service_id);
  if (pacing !== undefined) {
    const desviacion = Math.round(pacing - 100);
    if (desviacion > apoyo.umbral) motivos.push({ texto: `Gasto ${desviacion}% sobre el ritmo`, nivel: "rojo" });
    else if (desviacion < -apoyo.umbral) motivos.push({ texto: `Gasto ${Math.abs(desviacion)}% bajo el ritmo`, nivel: "ambar" });
  }

  if (base.estado === "bloqueada") motivos.push({ texto: base.bloqueada_motivo ?? "Bloqueada por aprobación pendiente", nivel: "ambar" });
  const aprob = apoyo.aprobaciones.get(base.cliente_id);
  if (aprob && base.estado !== "bloqueada") motivos.push({ texto: `${aprob.n === 1 ? "Aprobación" : `${aprob.n} aprobaciones`} sin respuesta hace ${aprob.dias} días`, nivel: "ambar" });
  if (diasAtraso > 0) {
    const extra = (base.abiertas ?? 1) - 1;
    motivos.push({ texto: `Atrasada ${diasAtraso} ${diasAtraso === 1 ? "día" : "días"}${extra > 0 ? ` · ${extra} semana${extra === 1 ? "" : "s"} más sin cerrar` : ""}`, nivel: "ambar" });
  }

  const pend = apoyo.pendientes.get(base.service_id);
  const cpa = snap?.cpa != null ? Number(snap.cpa) : conversiones && gasto != null ? gasto / conversiones : null;
  return {
    optimizationId: base.optimization_id,
    clienteId: base.cliente_id,
    clienteNombre: base.cliente_nombre,
    servicioTipo: base.tipo,
    responsable: base.responsable,
    fechaProgramada: base.fecha_programada,
    diasAtraso,
    semaforo: motivos.some((m) => m.nivel === "rojo") ? "rojo" : motivos.length > 0 ? "ambar" : "verde",
    motivos,
    ayer: snap ? { fecha: snap.periodo_inicio, gasto, conversiones, cpa: cpa && Number.isFinite(cpa) ? cpa : null } : null,
    pendientes: pend?.pendientes ?? null,
    ultimaOptimizacion: pend?.fecha ?? null,
    agenteEstado: base.agente_estado,
    aprobacionesSinRespuesta: aprob?.n ?? 0,
    conAprobacionPendiente: base.estado === "bloqueada" || !!aprob,
  };
}

interface OptRow extends ServicioBase {
  optimization_id: string;
  fecha_programada: string;
  estado: string;
  bloqueada_motivo: string | null;
  responsable: string | null;
  agente_estado: "en_curso" | "cerrada" | null;
  abiertas: string;
}

/** Cola de trabajo de la persona logueada: sus optimizaciones de Ads de hoy y atrasadas. */
export async function getMiDia(userId: string, usuarioNombre: string): Promise<MiDiaData> {
  const hoy = hoySantiago();
  const hoyIso = toIso(hoy);
  const semanaHastaIso = toIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 6));

  // Una fila por servicio: la optimización abierta más antigua (al cerrarla aparece la siguiente).
  const abiertas = await sql<OptRow[]>`
    select distinct on (o.service_id) o.id as optimization_id, o.fecha_programada, o.estado, o.bloqueada_motivo,
           s.id as service_id, s.tipo, c.id as cliente_id, c.nombre as cliente_nombre,
           u.nombre as responsable, ag.estado as agente_estado,
           count(*) over (partition by o.service_id) as abiertas
    from optimizations o
    join services s on s.id = o.service_id
    join clients c on c.id = o.client_id
    left join users u on u.id = o.responsable_id
    left join agent_sessions ag on ag.optimization_id = o.id
    where o.tipo in ('meta_ads', 'google_ads') and o.estado in ('programada', 'atrasada', 'bloqueada')
      and o.fecha_programada <= ${hoyIso} and o.responsable_id = ${userId}
      and c.estado = 'activo' and not s.pausado
    order by o.service_id, o.fecha_programada
  `;

  const apoyo = await apoyoPorServicio(abiertas, hoy);
  const orden = { rojo: 0, ambar: 1, verde: 2 } as const;
  const cola = abiertas
    .map((r) => armarFila({ ...r, abiertas: Number(r.abiertas) }, apoyo, hoyIso))
    // Más atrasada primero; a igual fecha, la que tiene más riesgo.
    .sort((a, b) => (a.fechaProgramada ?? "").localeCompare(b.fechaProgramada ?? "") || orden[a.semaforo] - orden[b.semaforo] || a.clienteNombre.localeCompare(b.clienteNombre));

  const semana = await sql<{ optimization_id: string; cliente_id: string; cliente_nombre: string; tipo: string; fecha_programada: string }[]>`
    select o.id as optimization_id, c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada
    from optimizations o join clients c on c.id = o.client_id
    where o.tipo in ('meta_ads', 'google_ads') and o.estado in ('programada', 'bloqueada')
      and o.fecha_programada > ${hoyIso} and o.fecha_programada <= ${semanaHastaIso}
      and o.responsable_id = ${userId} and c.estado = 'activo'
    order by o.fecha_programada, c.nombre
  `;

  return {
    hoyIso,
    usuarioNombre,
    resumen: {
      hoy: cola.filter((f) => f.diasAtraso === 0).length,
      atrasadas: cola.filter((f) => f.diasAtraso > 0).length,
      enRiesgo: cola.filter((f) => f.semaforo === "rojo").length,
      bloqueadas: cola.filter((f) => f.conAprobacionPendiente).length,
    },
    cola,
    semana: semana.map((r) => ({ optimizationId: r.optimization_id, clienteId: r.cliente_id, clienteNombre: r.cliente_nombre, servicioTipo: r.tipo, fecha: r.fecha_programada })),
  };
}

/** Cartera: todos los servicios de Ads activos del equipo, con su estado, de mayor a menor riesgo. */
export async function getCarteraAds(): Promise<FilaAds[]> {
  const hoy = hoySantiago();
  const hoyIso = toIso(hoy);

  const servicios = await sql<(ServicioBase & { optimization_id: string | null; fecha_programada: string | null; estado: string | null; bloqueada_motivo: string | null; responsable: string | null; agente_estado: "en_curso" | "cerrada" | null })[]>`
    select s.id as service_id, s.tipo, c.id as cliente_id, c.nombre as cliente_nombre,
           ab.optimization_id, ab.fecha_programada, ab.estado, ab.bloqueada_motivo, u.nombre as responsable, ab.agente_estado
    from services s
    join clients c on c.id = s.client_id
    left join users u on u.id = s.responsable_id
    left join lateral (
      select o.id as optimization_id, o.fecha_programada, o.estado, o.bloqueada_motivo, ag.estado as agente_estado
      from optimizations o left join agent_sessions ag on ag.optimization_id = o.id
      where o.service_id = s.id and o.estado in ('programada', 'atrasada', 'bloqueada') and o.fecha_programada <= ${hoyIso}
      order by o.fecha_programada limit 1
    ) ab on true
    where s.tipo in ('meta_ads', 'google_ads') and c.estado = 'activo' and not s.pausado
    order by c.nombre
  `;

  const apoyo = await apoyoPorServicio(servicios, hoy);
  const orden = { rojo: 0, ambar: 1, verde: 2 } as const;
  return servicios
    .map((r) => armarFila(r, apoyo, hoyIso))
    .sort((a, b) => orden[a.semaforo] - orden[b.semaforo] || b.diasAtraso - a.diasAtraso || a.clienteNombre.localeCompare(b.clienteNombre));
}
