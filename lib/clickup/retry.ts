import { sql } from "@/lib/db";
import { syncLogEntryToClickUp, syncOptimizationTaskToClickUp, type ServicioTipoClickUp } from "@/lib/clickup/client";

const LOTE = 20;

export interface ResultadoReintento {
  logEntries: { intentados: number; ok: number };
  optimizations: { intentados: number; ok: number };
}

/**
 * Job de reintento de `pendiente_sync` (§4.3: toda escritura a ClickUp con
 * reintentos y backoff). `clickupFetch` ya reintenta fallos 5xx transitorios
 * dentro de una misma llamada; esto cubre lo que sigue fallando después de
 * esos reintentos (token vencido, permisos, folder/doc borrado, etc.) — se
 * corre periódicamente (cron) y vuelve a intentar cada fila que no quedó en
 * `ok`. Ambas rutas son idempotentes: `syncOptimizationTaskToClickUp` usa
 * `clickup_task_id` si ya existe (actualiza, no duplica) y una entrada de
 * bitácora que ya se sincronizó nunca vuelve a intentarse porque su
 * `sync_status` ya es `ok`.
 */
export async function reintentarSyncPendiente(): Promise<ResultadoReintento> {
  const logEntriesPendientes = await sql<
    { id: string; client_id: string; titulo: string; tipo: string; contenido: string; fecha: string }[]
  >`
    select id, client_id, titulo, tipo, contenido, creado_en::date as fecha
    from log_entries
    where sync_status != 'ok'
    order by creado_en
    limit ${LOTE}
  `;

  let logEntriesOk = 0;
  for (const entrada of logEntriesPendientes) {
    const sync = await syncLogEntryToClickUp({
      clientId: entrada.client_id,
      fecha: entrada.fecha,
      titulo: entrada.titulo,
      tipo: entrada.tipo,
      contenido: entrada.contenido,
    });
    if (sync.ok) {
      logEntriesOk++;
      await sql`update log_entries set sync_status = 'ok', clickup_page_id = ${sync.clickupPageId ?? null} where id = ${entrada.id}`;
    }
  }

  const optimizacionesPendientes = await sql<
    {
      id: string;
      client_id: string;
      service_id: string;
      tipo: ServicioTipoClickUp;
      fecha_programada: string;
      hora_programada: string | null;
      responsable_id: string | null;
    }[]
  >`
    select id, client_id, service_id, tipo, fecha_programada, hora_programada, responsable_id
    from optimizations
    where sync_status != 'ok'
    order by fecha_programada
    limit ${LOTE}
  `;

  let optimizationsOk = 0;
  for (const optimizacion of optimizacionesPendientes) {
    const sync = await syncOptimizationTaskToClickUp({
      optimizationId: optimizacion.id,
      clientId: optimizacion.client_id,
      serviceId: optimizacion.service_id,
      servicioTipo: optimizacion.tipo,
      fechaProgramada: optimizacion.fecha_programada,
      horaProgramada: optimizacion.hora_programada,
      responsableId: optimizacion.responsable_id,
    });
    if (sync.ok) optimizationsOk++;
  }

  return {
    logEntries: { intentados: logEntriesPendientes.length, ok: logEntriesOk },
    optimizations: { intentados: optimizacionesPendientes.length, ok: optimizationsOk },
  };
}
