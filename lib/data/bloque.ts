import { sql } from "@/lib/db";

export interface ChecklistItemBloque {
  id: string;
  descripcion: string;
  completado: boolean;
}

export interface ItemBloque {
  optimizationId: string;
  serviceId: string;
  clienteId: string;
  clienteNombre: string;
  tipo: "meta_ads" | "google_ads";
  estado: string;
  responsable: string | null;
  notas: string | null;
  presupuesto: number | null;
  gastoAcumulado: number | null;
  pacingPct: number | null;
  alertaDisparada: boolean;
  checklist: ChecklistItemBloque[];
}

const TEMPLATE_ID: Record<string, string> = {
  meta_ads: "00000000-0000-0000-0000-000000000002",
  google_ads: "00000000-0000-0000-0000-000000000003",
};

async function ensureChecklist(optimizationId: string, clientId: string, serviceId: string, tipo: string): Promise<ChecklistItemBloque[]> {
  const [existente] = await sql<{ id: string }[]>`
    select id from checklist_instances where optimization_id = ${optimizationId} limit 1
  `;
  let instanceId = existente?.id;

  if (!instanceId) {
    const templateId = TEMPLATE_ID[tipo];
    const [instance] = await sql<{ id: string }[]>`
      insert into checklist_instances (template_id, client_id, service_id, optimization_id, estado)
      values (${templateId}, ${clientId}, ${serviceId}, ${optimizationId}, 'en_progreso')
      returning id
    `;
    instanceId = instance.id;
    const items = await sql<{ descripcion: string; orden: number }[]>`
      select descripcion, orden from checklist_items_template where template_id = ${templateId} order by orden
    `;
    for (const it of items) {
      await sql`insert into checklist_items (instance_id, orden, descripcion, estado) values (${instanceId}, ${it.orden}, ${it.descripcion}, 'pendiente')`;
    }
  }

  const rows = await sql<{ id: string; descripcion: string; estado: string }[]>`
    select id, descripcion, estado from checklist_items where instance_id = ${instanceId} order by orden
  `;
  return rows.map((r) => ({ id: r.id, descripcion: r.descripcion, completado: r.estado === "completado" }));
}

export async function getBloqueMiercoles(fecha: string): Promise<ItemBloque[]> {
  const rows = await sql<
    {
      optimization_id: string;
      client_id: string;
      cliente_nombre: string;
      service_id: string;
      tipo: "meta_ads" | "google_ads";
      estado: string;
      resumen: string | null;
      responsable_nombre: string | null;
      presupuesto: number | null;
      gasto_acumulado: number | null;
      pacing_pct: number | null;
      alerta_disparada: boolean | null;
    }[]
  >`
    select o.id as optimization_id, c.id as client_id, c.nombre as cliente_nombre, o.service_id, o.tipo,
           o.estado, o.resumen, u.nombre as responsable_nombre,
           b.presupuesto, b.gasto_acumulado, b.pacing_pct, b.alerta_disparada
    from optimizations o
    join clients c on c.id = o.client_id
    left join users u on u.id = o.responsable_id
    left join budgets b on b.service_id = o.service_id
      and b.mes = extract(month from o.fecha_programada) and b.anio = extract(year from o.fecha_programada)
    where o.fecha_programada = ${fecha} and o.tipo != 'seo_aeo_geo'
    order by c.nombre, o.tipo
  `;

  const items: ItemBloque[] = [];
  for (const r of rows) {
    const checklist = await ensureChecklist(r.optimization_id, r.client_id, r.service_id, r.tipo);
    items.push({
      optimizationId: r.optimization_id,
      serviceId: r.service_id,
      clienteId: r.client_id,
      clienteNombre: r.cliente_nombre,
      tipo: r.tipo,
      estado: r.estado,
      responsable: r.responsable_nombre,
      notas: r.resumen,
      presupuesto: r.presupuesto,
      gastoAcumulado: r.gasto_acumulado,
      pacingPct: r.pacing_pct,
      alertaDisparada: r.alerta_disparada ?? false,
      checklist,
    });
  }
  return items;
}
