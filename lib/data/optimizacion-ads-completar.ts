import { after } from "next/server";
import { sql } from "@/lib/db";
import { cerrarTareaOptimizacionEnClickUp, syncLogEntryToClickUp } from "@/lib/clickup/client";
import { generarOptimizacionesAds } from "@/lib/data/ads-calendario";
import { limitesSemana } from "@/lib/scheduling/ads-semanal";

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
 * optimización semanal del servicio. Las pendientes de esta semana o vencidas
 * del mismo servicio se cancelan: la optimización de hoy las reemplaza. Compartida por "Completar servicio" del
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

  // Lo que cuenta es el día en que se hace: la optimización de hoy reemplaza a las pendientes de esta semana y a las
  // vencidas del servicio, que se descartan (si no se hicieron a su tiempo, no se arrastran). Sin esto, completar una
  // optimización programada para una fecha vieja dejaba igual la de esta semana como pendiente.
  const { domingo } = limitesSemana(fechaRealizada);
  const reemplazadas = await sql<{ clickup_task_id: string | null }[]>`
    update optimizations set estado = 'cancelada', bloqueada_motivo = null
    where service_id = ${actual?.service_id ?? null} and id != ${optimizationId}
      and estado in ('programada', 'bloqueada') and fecha_programada <= ${domingo}
    returning clickup_task_id
  `;
  for (const r of reemplazadas) {
    if (r.clickup_task_id) after(() => cerrarTareaOptimizacionEnClickUp(r.clickup_task_id!));
  }

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
