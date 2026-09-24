import { sql } from "@/lib/db";
import { TIPOS_APROBACION, type ApprovalTipo } from "@/lib/approvals-tipos";

export { TIPOS_APROBACION, type ApprovalTipo };

export type ApprovalEstado = "enviado" | "aprobado" | "rechazado" | "sin_respuesta";

export interface ApprovalResumen {
  id: string;
  tipo: ApprovalTipo;
  descripcion: string;
  link: string | null;
  canal: string | null;
  enviadoEn: string;
  estado: ApprovalEstado;
  resueltoEn: string | null;
  recordatorios: number;
  optimizacionId: string | null;
  optimizacionTipo: string | null;
  optimizacionFecha: string | null;
}

interface ApprovalRow {
  id: string;
  tipo: ApprovalTipo;
  descripcion: string;
  link: string | null;
  canal: string | null;
  enviado_en: string;
  estado: ApprovalEstado;
  resuelto_en: string | null;
  recordatorios: string;
  optimization_id: string | null;
  optimizacion_tipo: string | null;
  optimizacion_fecha: string | null;
}

/** Aprobaciones del cliente, pendientes primero — `estado` viene de `approvals_view.estado_efectivo` (§4.2, mismo patrón sin-cron que services_view/discounts_view: "sin_respuesta" se calcula al consultar, no se guarda a mano). */
export async function listarAprobacionesCliente(clientId: string): Promise<ApprovalResumen[]> {
  const rows = await sql<ApprovalRow[]>`
    select
      av.id, av.tipo, av.descripcion, av.link, av.canal, av.enviado_en, av.resuelto_en,
      av.estado_efectivo as estado, av.optimization_id,
      o.tipo as optimizacion_tipo, o.fecha_programada as optimizacion_fecha,
      (select count(*) from approval_reminders r where r.approval_id = av.id) as recordatorios
    from approvals_view av
    left join optimizations o on o.id = av.optimization_id
    where av.client_id = ${clientId}
    order by (case when av.estado_efectivo in ('enviado', 'sin_respuesta') then 0 else 1 end), av.enviado_en desc
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    descripcion: r.descripcion,
    link: r.link,
    canal: r.canal,
    enviadoEn: r.enviado_en,
    estado: r.estado,
    resueltoEn: r.resuelto_en,
    recordatorios: Number(r.recordatorios),
    optimizacionId: r.optimization_id,
    optimizacionTipo: r.optimizacion_tipo,
    optimizacionFecha: r.optimizacion_fecha,
  }));
}

export interface OptimizacionBloqueable {
  id: string;
  tipo: string;
  fecha: string;
}

/** Próximas optimizaciones del cliente todavía sin realizar (`programada`/`bloqueada`) — para el selector "bloquea esta optimización" al registrar una aprobación. */
export async function listarOptimizacionesBloqueables(clientId: string): Promise<OptimizacionBloqueable[]> {
  const rows = await sql<{ id: string; tipo: string; fecha_programada: string }[]>`
    select id, tipo, fecha_programada from optimizations
    where client_id = ${clientId} and estado in ('programada', 'bloqueada')
    order by fecha_programada asc
    limit 5
  `;
  return rows.map((r) => ({ id: r.id, tipo: r.tipo, fecha: r.fecha_programada }));
}
