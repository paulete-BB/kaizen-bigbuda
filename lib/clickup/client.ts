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

/**
 * Registro único del webhook `taskStatusUpdated` (§3.5) contra el workspace
 * completo — cubre las dos carpetas de servicio y cualquier lista de
 * fallback sin necesitar un webhook por lista. No se llama desde ningún
 * flujo de la app: se corre una sola vez a mano (consola/script) después de
 * que `/api/clickup/webhook` esté desplegado y accesible públicamente,
 * porque ClickUp no acepta un endpoint que no responda. El `secret` que
 * devuelve la API queda guardado en `settings` para verificar la firma de
 * cada entrega (`lib/clickup/webhook.ts`) — no se puede generar de
 * antemano, lo asigna ClickUp al crear el webhook.
 */
export async function registrarWebhookClickUp(endpointUrl: string): Promise<{ ok: boolean; webhookId?: string }> {
  try {
    const settings = await getSettings();
    if (!settings.clickupWorkspaceId) return { ok: false };

    const res = await clickupFetch(`${API_V2}/team/${settings.clickupWorkspaceId}/webhook`, {
      method: "POST",
      body: JSON.stringify({ endpoint: endpointUrl, events: ["taskStatusUpdated"] }),
    });
    const data = (await res.json()) as { id: string; webhook: { secret: string } };

    await sql`
      update settings set clickup_webhook_id = ${data.id}, clickup_webhook_secret = ${data.webhook.secret}
      where id = 1
    `;
    return { ok: true, webhookId: data.id };
  } catch (e) {
    if (process.env.CLICKUP_DEBUG) console.error("registrarWebhookClickUp error:", e);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Tareas/bloques de calendario (§3.5)
// ---------------------------------------------------------------------------

export type ServicioTipoClickUp = "seo_aeo_geo" | "meta_ads" | "google_ads";

export interface ClickUpTaskPayload {
  optimizationId: string;
  clientId: string;
  serviceId: string;
  servicioTipo: ServicioTipoClickUp;
  fechaProgramada: string;
  horaProgramada?: string | null;
  responsableId?: string | null;
}

export interface ClickUpTaskResult {
  ok: boolean;
  clickupTaskId?: string;
}

const SERVICIO_LABEL: Record<ServicioTipoClickUp, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

/** Offset real (en minutos) de un timezone IANA en un instante dado — usa la Intl tzdb, así que respeta DST sin hardcodear reglas de Chile que puedan cambiar. */
function offsetMinutosTz(timeZone: string, atUtcMs: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atUtcMs));
  const get = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (comoUtc - atUtcMs) / 60_000;
}

/** Epoch ms (UTC) de una fecha/hora expresada en America/Santiago — lo que espera due_date/start_date de ClickUp. */
function epochMsSantiago(fechaIso: string, hora: string): number {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const intento = Date.UTC(y, m - 1, d, hh, mm);
  return intento - offsetMinutosTz("America/Santiago", intento) * 60_000;
}

/**
 * La estructura real del workspace tiene una carpeta por línea de servicio
 * ("SEO + IA" / "Marketing (Ads)") con una lista ya existente por cliente,
 * no una sola lista global "Operaciones" — se busca la lista del cliente
 * dentro de la carpeta correspondiente y se cachea en
 * `services.clickup_list_id`; si no existe (cliente nuevo sin lista todavía
 * en ClickUp), cae a `settings.clickup_default_list_id`.
 */
async function resolverListaOptimizacion(
  folderId: string | null,
  serviceId: string,
  clienteNombre: string,
  defaultListId: string | null,
): Promise<string | null> {
  const [servicio] = await sql<{ clickup_list_id: string | null }[]>`
    select clickup_list_id from services where id = ${serviceId}
  `;
  if (servicio?.clickup_list_id) return servicio.clickup_list_id;

  if (folderId) {
    const res = await clickupFetch(`${API_V2}/folder/${folderId}/list`, { method: "GET" });
    const { lists } = (await res.json()) as { lists: { id: string; name: string }[] };
    const existente = lists.find((l) => l.name === clienteNombre);
    if (existente) {
      await sql`update services set clickup_list_id = ${existente.id} where id = ${serviceId}`;
      return existente.id;
    }
  }

  return defaultListId;
}

/**
 * Crea o actualiza la tarea de ClickUp de una optimización programada
 * (§3.5) — visible en la vista Calendario de ClickUp del equipo. Si la
 * optimización ya tiene `clickup_task_id`, actualiza fecha/responsable en
 * vez de crear una tarea duplicada. Cualquier falla degrada a `{ok:false}`
 * (la fila queda/sigue en `pendiente_sync`).
 */
export async function syncOptimizationTaskToClickUp(payload: ClickUpTaskPayload): Promise<ClickUpTaskResult> {
  try {
    const settings = await getSettings();
    const folderId = payload.servicioTipo === "seo_aeo_geo" ? settings.clickupFolderSeoId : settings.clickupFolderAdsId;

    const [cliente] = await sql<{ nombre: string }[]>`select nombre from clients where id = ${payload.clientId}`;
    if (!cliente) return { ok: false };

    const listId = await resolverListaOptimizacion(folderId, payload.serviceId, cliente.nombre, settings.clickupDefaultListId);
    if (!listId) return { ok: false };

    const [existente] = await sql<{ clickup_task_id: string | null }[]>`
      select clickup_task_id from optimizations where id = ${payload.optimizationId}
    `;

    let assigneeClickupId: number | null = null;
    if (payload.responsableId) {
      const [responsable] = await sql<{ clickup_user_id: string | null }[]>`
        select clickup_user_id from users where id = ${payload.responsableId}
      `;
      if (responsable?.clickup_user_id) assigneeClickupId = Number(responsable.clickup_user_id);
    }

    const hora = payload.horaProgramada ?? (payload.servicioTipo === "seo_aeo_geo" ? "12:00" : "16:00");
    const fechaMs = epochMsSantiago(payload.fechaProgramada, hora);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const enlace = appUrl ? `\n\n${appUrl}/clientes/${payload.clientId}` : `\n\n(ficha del cliente: /clientes/${payload.clientId})`;

    const body = {
      name: `Optimización ${SERVICIO_LABEL[payload.servicioTipo]} — ${cliente.nombre}`,
      description: `Optimización ${SERVICIO_LABEL[payload.servicioTipo]} para ${cliente.nombre}, generada por Kaizen Bigbuda.${enlace}`,
      due_date: fechaMs,
      due_date_time: true,
      start_date: fechaMs,
      start_date_time: true,
      tags: ["optimizacion", payload.servicioTipo === "seo_aeo_geo" ? "seo" : "ads", cliente.nombre],
      ...(assigneeClickupId ? { assignees: [assigneeClickupId] } : {}),
    };

    const taskId = existente?.clickup_task_id;
    const res = taskId
      ? await clickupFetch(`${API_V2}/task/${taskId}`, { method: "PUT", body: JSON.stringify(body) })
      : await clickupFetch(`${API_V2}/list/${listId}/task`, { method: "POST", body: JSON.stringify(body) });
    const task = (await res.json()) as { id: string };

    await sql`update optimizations set clickup_task_id = ${task.id}, sync_status = 'ok' where id = ${payload.optimizationId}`;
    return { ok: true, clickupTaskId: task.id };
  } catch (e) {
    if (process.env.CLICKUP_DEBUG) console.error("syncOptimizationTaskToClickUp error:", e);
    await sql`update optimizations set sync_status = 'pendiente_sync' where id = ${payload.optimizationId}`.catch(() => {});
    return { ok: false };
  }
}
