"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { completarOptimizacionAds } from "@/lib/data/optimizacion-ads-completar";
import { hoySantiago, toIso } from "@/lib/dates";

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

  await completarOptimizacionAds({ optimizationId, clientId, tipoLabel, userId: session.userId, fechaRealizada: toIso(hoySantiago()) });

  revalidatePath(`/optimizaciones/bloque/${fecha}`);
}
