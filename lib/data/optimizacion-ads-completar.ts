import { after } from "next/server";
import { sql } from "@/lib/db";
import { cerrarTareaOptimizacionEnClickUp, syncLogEntryToClickUp, syncOptimizationTaskToClickUp } from "@/lib/clickup/client";
import { addDaysIso } from "@/lib/dates";
import { esFeriado, diaHabilSiguiente } from "@/lib/scheduling/holidays";
import type { Holiday } from "@/lib/scheduling/types";

export interface CompletarOptimizacionAdsInput {
  optimizationId: string;
  clientId: string;
  tipoLabel: string;
  userId: string;
  /** Fecha en que se registra como realizada. */
  fechaRealizada: string;
  /** Fecha desde la que se calcula la próxima (semana siguiente, mismo día). Para el bloque del día es la misma fechaRealizada. */
  fechaBase: string;
  /** Texto para la bitácora; sin él queda la nota genérica del bloque. */
  contenidoBitacora?: string;
  /** Solo se actualizan si vienen (el cierre con el agente los deja registrados para la próxima optimización). */
  hallazgos?: string | null;
  proximosPasos?: string | null;
}

/**
 * Cierra una optimización de Ads (§3.2 Regla B): marca `realizada`, deja la
 * entrada en la bitácora (interna + ClickUp, con `after()` para no bloquear
 * la respuesta), cierra la tarea real en ClickUp y genera la próxima
 * optimización semanal del servicio. Compartida por "Completar servicio" del
 * bloque y por el cierre con el agente — mismo comportamiento en ambos.
 */
export async function completarOptimizacionAds(input: CompletarOptimizacionAdsInput): Promise<void> {
  const { optimizationId, clientId, tipoLabel, userId, fechaRealizada, fechaBase } = input;

  const [actual] = await sql<
    { service_id: string; tipo: "meta_ads" | "google_ads"; clickup_task_id: string | null; responsable_id: string | null; pausado: boolean }[]
  >`
    select o.service_id, o.tipo, o.clickup_task_id, o.responsable_id, s.pausado
    from optimizations o join services s on s.id = o.service_id
    where o.id = ${optimizationId}
  `;

  await sql`
    update optimizations set estado = 'realizada', fecha_realizada = ${fechaRealizada}, sync_status = 'pendiente_sync',
      hallazgos = coalesce(${input.hallazgos ?? null}, hallazgos), proximos_pasos = coalesce(${input.proximosPasos ?? null}, proximos_pasos)
    where id = ${optimizationId}
  `;

  const contenido = input.contenidoBitacora?.trim() || "Bloque de ads del miércoles completado.";
  const [entrada] = await sql<{ id: string }[]>`
    insert into log_entries (client_id, optimization_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${clientId}, ${optimizationId}, ${"Optimización " + tipoLabel}, 'Optimización', ${contenido}, 'pendiente_sync', ${userId})
    returning id
  `;
  after(async () => {
    const sync = await syncLogEntryToClickUp({ clientId, fecha: fechaRealizada, titulo: "Optimización " + tipoLabel, tipo: "Optimización", contenido });
    if (sync.ok) await sql`update log_entries set sync_status = 'ok', clickup_page_id = ${sync.clickupPageId ?? null} where id = ${entrada.id}`;
  });

  if (actual?.clickup_task_id) {
    after(() => cerrarTareaOptimizacionEnClickUp(actual.clickup_task_id!));
  }

  if (actual && !actual.pausado) {
    const anio = Number(fechaBase.slice(0, 4));
    const holidays = await sql<Holiday[]>`select fecha, nombre from holidays where anio in (${anio}, ${anio + 1})`;
    let candidata = addDaysIso(fechaBase, 7);
    // Si se completó con atraso, la próxima sigue siendo el mismo día de la semana, pero nunca en el pasado.
    while (candidata <= fechaRealizada) candidata = addDaysIso(candidata, 7);
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
}
