import { sql } from "@/lib/db";
import { addDaysIso } from "@/lib/dates";
import { fridaysOfMonth } from "@/lib/scheduling/dates";

const TEMPLATE_ID = "00000000-0000-0000-0000-000000000001";

export interface ChecklistItemSeo {
  id: string;
  descripcion: string;
  completado: boolean;
}

export interface RegistroSeoDetalle {
  optimizationId: string;
  serviceId: string;
  clientId: string;
  clienteNombre: string;
  clienteIniciales: string;
  fechaProgramada: string;
  responsable: string | null;
  responsableId: string | null;
  estado: string;
  resumen: string | null;
  hallazgos: string | null;
  proximosPasos: string | null;
  proximaFechaPropuesta: string;
  informeEnviadoEn: string | null;
  checklist: ChecklistItemSeo[];
}

function proximaFechaPropuesta(fechaProgramada: string, viernesOrdinal: number | null): string {
  const [y, m] = fechaProgramada.split("-").map(Number);
  const siguienteMes = m === 12 ? 1 : m + 1;
  const siguienteAnio = m === 12 ? y + 1 : y;
  if (viernesOrdinal) {
    const fridays = fridaysOfMonth(siguienteAnio, siguienteMes);
    if (fridays[viernesOrdinal - 1]) return fridays[viernesOrdinal - 1];
  }
  return addDaysIso(fechaProgramada, 28);
}

export async function getRegistroSeo(optimizationId: string): Promise<RegistroSeoDetalle | null> {
  const [row] = await sql<
    {
      id: string;
      service_id: string;
      client_id: string;
      cliente_nombre: string;
      fecha_programada: string;
      responsable_id: string | null;
      responsable_nombre: string | null;
      estado: string;
      resumen: string | null;
      hallazgos: string | null;
      proximos_pasos: string | null;
      proxima_fecha: string | null;
      informe_enviado_en: string | null;
      viernes_ordinal_asignado: number | null;
    }[]
  >`
    select o.id, o.service_id, c.id as client_id, c.nombre as cliente_nombre, o.fecha_programada,
           o.responsable_id, u.nombre as responsable_nombre, o.estado, o.resumen, o.hallazgos, o.proximos_pasos,
           o.proxima_fecha, o.informe_enviado_en, s.viernes_ordinal_asignado
    from optimizations o
    join clients c on c.id = o.client_id
    join services s on s.id = o.service_id
    left join users u on u.id = o.responsable_id
    where o.id = ${optimizationId} and o.tipo = 'seo_aeo_geo'
  `;
  if (!row) return null;

  const [existente] = await sql<{ id: string }[]>`select id from checklist_instances where optimization_id = ${optimizationId} limit 1`;
  let instanceId = existente?.id;
  if (!instanceId) {
    const [instance] = await sql<{ id: string }[]>`
      insert into checklist_instances (template_id, client_id, service_id, optimization_id, estado)
      values (${TEMPLATE_ID}, ${row.client_id}, ${row.service_id}, ${optimizationId}, 'en_progreso')
      returning id
    `;
    instanceId = instance.id;
    const items = await sql<{ descripcion: string; orden: number }[]>`
      select descripcion, orden from checklist_items_template where template_id = ${TEMPLATE_ID} order by orden
    `;
    for (const it of items) {
      await sql`insert into checklist_items (instance_id, orden, descripcion, estado) values (${instanceId}, ${it.orden}, ${it.descripcion}, 'pendiente')`;
    }
  }
  const checklistRows = await sql<{ id: string; descripcion: string; estado: string }[]>`
    select id, descripcion, estado from checklist_items where instance_id = ${instanceId} order by orden
  `;

  return {
    optimizationId: row.id,
    serviceId: row.service_id,
    clientId: row.client_id,
    clienteNombre: row.cliente_nombre,
    clienteIniciales: row.cliente_nombre.slice(0, 1).toUpperCase(),
    fechaProgramada: row.fecha_programada,
    responsable: row.responsable_nombre,
    responsableId: row.responsable_id,
    estado: row.estado,
    resumen: row.resumen,
    hallazgos: row.hallazgos,
    proximosPasos: row.proximos_pasos,
    proximaFechaPropuesta: row.proxima_fecha ?? proximaFechaPropuesta(row.fecha_programada, row.viernes_ordinal_asignado),
    informeEnviadoEn: row.informe_enviado_en,
    checklist: checklistRows.map((c) => ({ id: c.id, descripcion: c.descripcion, completado: c.estado === "completado" })),
  };
}
