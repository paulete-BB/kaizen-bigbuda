export interface ClickUpSyncPayload {
  clienteNombre: string;
  fecha: string;
  titulo: string;
  tipo: string;
  contenido: string;
}

export interface ClickUpSyncResult {
  ok: boolean;
  clickupPageId?: string;
}

/**
 * Punto de integración preparado para la escritura real en el ClickUp Doc
 * del cliente (§3.3) — Fase 2. Todavía no llama a la API de ClickUp; siempre
 * devuelve `ok: false`, que es exactamente el camino de fallback que pide el
 * brief: la entrada queda en la bitácora interna con `pendiente_sync` y un
 * job de reintento la sincroniza después (ese job tampoco existe aún).
 *
 * Cuando se conecte la API real (`POST /docs/{doc_id}/pages`), el formato
 * del Doc sale de exactamente estos mismos campos:
 *   ## [{fecha}] {titulo}
 *   **Tipo:** {tipo}
 *   {contenido}
 */
export async function syncLogEntryToClickUp(_payload: ClickUpSyncPayload): Promise<ClickUpSyncResult> {
  return { ok: false };
}
