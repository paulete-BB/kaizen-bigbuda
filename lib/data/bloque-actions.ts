"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { cerrarTareaOptimizacionEnClickUp, syncOptimizationTaskToClickUp } from "@/lib/clickup/client";
import { addDaysIso } from "@/lib/dates";
import { esFeriado, diaHabilSiguiente } from "@/lib/scheduling/holidays";
import type { Holiday } from "@/lib/scheduling/types";

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

/**
 * Completar un servicio de Ads en el bloque (§3.2 Regla B): cierra dos
 * huecos reales de Fase 2, documentados desde que se construyó el sync de
 * tareas y nunca resueltos.
 *
 * 1. **Cerrar la tarea real en ClickUp** — antes la tarea quedaba abierta
 *    para siempre en la lista del cliente, aunque la optimización ya
 *    estuviera `realizada` en la plataforma.
 * 2. **Generar la próxima optimización semanal** — antes no existía
 *    ningún mecanismo que la creara: un servicio de Ads se quedaba sin
 *    nada programado en cuanto se completaba su única optimización
 *    pendiente (la del onboarding). Como Regla B ya fija el día de la
 *    semana del servicio (`dia_semana_ads_asignado`), la próxima fecha es
 *    determinística — siempre la misma semana siguiente, sin necesitar
 *    que el equipo la elija a mano (a diferencia de SEO, que sí deja
 *    editar la fecha propuesta en su registro).
 */
export async function completarServicioBloque(formData: FormData) {
  const session = await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const tipoLabel = String(formData.get("tipoLabel") ?? "");
  if (!optimizationId) return;

  const [actual] = await sql<
    { service_id: string; tipo: "meta_ads" | "google_ads"; clickup_task_id: string | null; responsable_id: string | null; pausado: boolean }[]
  >`
    select o.service_id, o.tipo, o.clickup_task_id, o.responsable_id, s.pausado
    from optimizations o join services s on s.id = o.service_id
    where o.id = ${optimizationId}
  `;

  await sql`update optimizations set estado = 'realizada', fecha_realizada = ${fecha}, sync_status = 'pendiente_sync' where id = ${optimizationId}`;
  await sql`
    insert into log_entries (client_id, optimization_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${clientId}, ${optimizationId}, ${"Optimización " + tipoLabel}, 'Optimización', 'Bloque de ads del miércoles completado.', 'pendiente_sync', ${session.userId})
  `;

  if (actual?.clickup_task_id) {
    after(() => cerrarTareaOptimizacionEnClickUp(actual.clickup_task_id!));
  }

  if (actual && !actual.pausado) {
    const anio = Number(fecha.slice(0, 4));
    const holidays = await sql<Holiday[]>`select fecha, nombre from holidays where anio = ${anio}`;
    const candidata = addDaysIso(fecha, 7);
    const proximaFecha = esFeriado(candidata, holidays) ? diaHabilSiguiente(candidata, holidays) : candidata;

    const [{ id: proximaOptimizationId }] = await sql<{ id: string }[]>`
      insert into optimizations (client_id, service_id, tipo, fecha_programada, responsable_id, estado, sync_status)
      values (${clientId}, ${actual.service_id}, ${actual.tipo}, ${proximaFecha}, ${actual.responsable_id}, 'programada', 'pendiente_sync')
      returning id
    `;
    after(() =>
      syncOptimizationTaskToClickUp({
        optimizationId: proximaOptimizationId,
        clientId,
        serviceId: actual.service_id,
        servicioTipo: actual.tipo,
        fechaProgramada: proximaFecha,
        responsableId: actual.responsable_id,
      }),
    );
  }

  revalidatePath(`/optimizaciones/bloque/${fecha}`);
}
