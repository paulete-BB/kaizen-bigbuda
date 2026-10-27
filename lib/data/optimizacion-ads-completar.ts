import { after } from "next/server";
import { sql } from "@/lib/db";
import { cerrarTareaOptimizacionEnClickUp, syncLogEntryToClickUp } from "@/lib/clickup/client";
import { generarOptimizacionesAds } from "@/lib/data/ads-calendario";

export interface CompletarOptimizacionAdsInput {
  optimizationId: string;
  clientId: string;
  tipoLabel: string;
  userId: string;
  /** Fecha en que se registra como realizada: siempre el día en que se ejecuta, nunca la fecha en que estaba programada. */
  fechaRealizada: string;
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
  const { optimizationId, clientId, tipoLabel, userId, fechaRealizada } = input;

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

  const contenido = input.contenidoBitacora?.trim() || "Bloque de Ads completado.";
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

  // La próxima semana ya no se inserta aquí: el calendario semanal (4 semanas) se mantiene solo y es
  // idempotente, así que completar una optimización nunca duplica la siguiente.
  if (actual && !actual.pausado) await generarOptimizacionesAds({ serviceId: actual.service_id });
}
