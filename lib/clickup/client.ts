import { sql } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";

export interface ClickUpSyncPayload {
  clientId: string;
  fecha: string;
  titulo: string;
  tipo: string;
  contenido: string;
}

export interface ClickUpSyncResult {
  ok: boolean;
  clickupPageId?: string;
}

const API_V2 = "https://api.clickup.com/api/v2";
const API_V3 = "https://api.clickup.com/api/v3";

function nombrePaginaBitacora(clienteNombre: string) {
  return `${clienteNombre} · Bitácora Kaizen`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * La API de ClickUp devuelve 5xx intermitentes incluso en llamadas de
 * lectura simples (confirmado empíricamente contra el workspace real, no
 * es algo hipotético) — reintenta esos casos con backoff antes de
 * degradar a `pendiente_sync` (§4.3: reintentos con backoff exponencial).
 */
async function clickupFetch(url: string, init: RequestInit, intentos = 4) {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN no configurado");

  let ultimoError: Error | null = null;
  for (let intento = 0; intento < intentos; intento++) {
    if (intento > 0) await sleep(300 * 2 ** (intento - 1));
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: token, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return res;
    ultimoError = new Error(`ClickUp API ${res.status}: ${await res.text().catch(() => "")}`);
    if (res.status < 500) throw ultimoError;
  }
  throw ultimoError;
}

/**
 * El Doc real de Bigbuda ("Bitácoras de Clientes") es compartido por todos
 * los clientes, con una página por cliente mantenida a mano por el equipo
 * (accesos, objetivos, reuniones). Para no arriesgar pisar ese contenido,
 * cada cliente tiene su propia página *dedicada* solo para lo que escribe
 * la plataforma — se busca/crea por nombre la primera vez y su id queda
 * cacheado en `clients.clickup_bitacora_page_id`.
 */
async function resolverPaginaBitacora(
  workspaceId: string,
  docId: string,
  clientId: string,
  clienteNombre: string,
): Promise<string> {
  const [cliente] = await sql<{ clickup_bitacora_page_id: string | null }[]>`
    select clickup_bitacora_page_id from clients where id = ${clientId}
  `;
  if (cliente?.clickup_bitacora_page_id) return cliente.clickup_bitacora_page_id;

  const nombrePagina = nombrePaginaBitacora(clienteNombre);

  const listRes = await clickupFetch(`${API_V3}/workspaces/${workspaceId}/docs/${docId}/pages`, { method: "GET" });
  const pages = (await listRes.json()) as { id: string; name: string | null }[];
  const existente = pages.find((p) => p.name === nombrePagina);

  const pageId =
    existente?.id ??
    (
      (await (
        await clickupFetch(`${API_V3}/workspaces/${workspaceId}/docs/${docId}/pages`, {
          method: "POST",
          body: JSON.stringify({
            name: nombrePagina,
            content: `# ${nombrePagina}\n\nBitácora automática de optimizaciones y cambios — generada por Kaizen Bigbuda. No editar a mano (ver la ficha del cliente para notas manuales).`,
            content_format: "text/md",
          }),
        })
      ).json()) as { id: string }
    ).id;

  await sql`update clients set clickup_bitacora_page_id = ${pageId} where id = ${clientId}`;
  return pageId;
}

function formatearEntrada(payload: ClickUpSyncPayload) {
  return `\n\n---\n### ${payload.fecha} · ${payload.titulo}\n**Tipo:** ${payload.tipo}\n\n${payload.contenido}`;
}

/**
 * Escribe la entrada en la página de bitácora dedicada del cliente (§3.3).
 * Cualquier falla (token ausente, timeout, permisos, API caída) degrada a
 * `{ok:false}` — el llamador guarda la entrada en la bitácora interna con
 * `pendiente_sync`, tal como pedía el stub original.
 */
export async function syncLogEntryToClickUp(payload: ClickUpSyncPayload): Promise<ClickUpSyncResult> {
  try {
    const settings = await getSettings();
    if (!settings.clickupWorkspaceId || !settings.clickupBitacoraDocId) return { ok: false };

    const [cliente] = await sql<{ nombre: string }[]>`select nombre from clients where id = ${payload.clientId}`;
    if (!cliente) return { ok: false };

    const pageId = await resolverPaginaBitacora(
      settings.clickupWorkspaceId,
      settings.clickupBitacoraDocId,
      payload.clientId,
      cliente.nombre,
    );

    await clickupFetch(`${API_V3}/workspaces/${settings.clickupWorkspaceId}/docs/${settings.clickupBitacoraDocId}/pages/${pageId}`, {
      method: "PUT",
      body: JSON.stringify({
        content: formatearEntrada(payload),
        content_format: "text/md",
        content_edit_mode: "append",
      }),
    });

    return { ok: true, clickupPageId: pageId };
  } catch (e) {
    if (process.env.CLICKUP_DEBUG) console.error("syncLogEntryToClickUp error:", e);
    return { ok: false };
  }
}

/** Usa API v2 solo para validar el token contra el team — no se usa en el flujo normal. */
export async function verificarConexionClickUp(): Promise<boolean> {
  try {
    await clickupFetch(`${API_V2}/team`, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}
