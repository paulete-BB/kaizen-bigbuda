"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export async function toggleChecklistItemBloque(formData: FormData) {
  await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  if (!itemId) return;
  await sql`
    update checklist_items
    set estado = (case when estado = 'completado' then 'pendiente' else 'completado' end)::checklist_item_estado
    where id = ${itemId}
  `;
  revalidatePath(`/optimizaciones/bloque/${fecha}`);
}

export async function guardarAvanceBloque(formData: FormData) {
  await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const notas = String(formData.get("notas") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const gasto = Number(formData.get("gasto") ?? 0);
  const presupuesto = Number(formData.get("presupuesto") ?? 0);
  const mes = Number(formData.get("mes") ?? 0);
  const anio = Number(formData.get("anio") ?? 0);
  if (!optimizationId) return;

  await sql`update optimizations set resumen = ${notas} where id = ${optimizationId}`;

  if (serviceId && (gasto > 0 || presupuesto > 0)) {
    const [existente] = await sql<{ presupuesto: number }[]>`
      select presupuesto from budgets where service_id = ${serviceId} and mes = ${mes} and anio = ${anio}
    `;
    const presupuestoFinal = presupuesto > 0 ? presupuesto : existente?.presupuesto ?? 0;
    if (presupuestoFinal > 0) {
      const pacing = Math.round((gasto / presupuestoFinal) * 100);
      const alerta = pacing >= 115 || pacing <= 85;
      await sql`
        insert into budgets (service_id, mes, anio, presupuesto, gasto_acumulado, pacing_pct, alerta_disparada)
        values (${serviceId}, ${mes}, ${anio}, ${presupuestoFinal}, ${gasto}, ${pacing}, ${alerta})
        on conflict (service_id, mes, anio) do update set
          presupuesto = ${presupuestoFinal},
          gasto_acumulado = ${gasto},
          pacing_pct = ${pacing},
          alerta_disparada = ${alerta},
          actualizado_en = now()
      `;
    }
  }
  revalidatePath(`/optimizaciones/bloque/${fecha}`);
}

export async function completarServicioBloque(formData: FormData) {
  const session = await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const tipoLabel = String(formData.get("tipoLabel") ?? "");
  if (!optimizationId) return;

  await sql`update optimizations set estado = 'realizada', fecha_realizada = ${fecha}, sync_status = 'pendiente_sync' where id = ${optimizationId}`;
  await sql`
    insert into log_entries (client_id, optimization_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${clientId}, ${optimizationId}, ${"Optimización " + tipoLabel}, 'Optimización', 'Bloque de ads del miércoles completado.', 'pendiente_sync', ${session.userId})
  `;
  revalidatePath(`/optimizaciones/bloque/${fecha}`);
}
