"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncLogEntryToClickUp } from "@/lib/clickup/client";

/**
 * Inserta el registro ya (siempre `pendiente_sync`) y agenda el intento de
 * sync a ClickUp con `after()` en vez de esperarlo — esperar podía tardar
 * ~30-40s (4 reintentos con backoff) si ClickUp estaba lento, dejando
 * `toggleOffboardingItem` colgado en el último ítem del checklist (el que
 * dispara esta bitácora). Con `after()` la acción vuelve casi al instante;
 * si el sync falla, la fila queda en `pendiente_sync` para el cron de
 * reintento (§4.3).
 */
async function registrarBitacora(opts: { clientId: string; titulo: string; tipo: string; contenido: string; creadoPor: string }) {
  const [{ id: logId }] = await sql<{ id: string }[]>`
    insert into log_entries (client_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${opts.clientId}, ${opts.titulo}, ${opts.tipo}, ${opts.contenido}, 'pendiente_sync', ${opts.creadoPor})
    returning id
  `;
  after(async () => {
    const sync = await syncLogEntryToClickUp({
      clientId: opts.clientId,
      fecha: new Date().toISOString().slice(0, 10),
      titulo: opts.titulo,
      tipo: opts.tipo,
      contenido: opts.contenido,
    });
    if (sync.ok) {
      await sql`update log_entries set sync_status = 'ok', clickup_page_id = ${sync.clickupPageId ?? null} where id = ${logId}`;
    }
  });
}

export async function toggleOffboardingItem(formData: FormData) {
  const session = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!itemId || !clientId) return;

  await sql`
    update checklist_items
    set estado = (case when estado = 'completado' then 'pendiente' else 'completado' end)::checklist_item_estado
    where id = ${itemId}
  `;

  const [{ pendientes }] = await sql<{ pendientes: string }[]>`
    select count(*) as pendientes
    from checklist_items ci
    join checklist_instances inst on inst.id = ci.instance_id
    where inst.client_id = ${clientId}
      and inst.template_id in (select id from checklist_templates where tipo = 'offboarding')
      and ci.estado != 'completado'
  `;
  if (Number(pendientes) === 0) {
    await registrarBitacora({
      clientId,
      titulo: "Cierre del cliente completado",
      tipo: "Offboarding",
      contenido: "Todos los ítems del checklist de cierre quedaron completados.",
      creadoPor: session.userId,
    });
  }

  revalidatePath(`/clientes/${clientId}`);
}

export interface AccionOffboardingResultado {
  ok: boolean;
  error?: string;
}

export async function marcarRetencionDatos(formData: FormData): Promise<AccionOffboardingResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  if (!clientId) return { ok: false, error: "Cliente inválido." };
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede editar la retención de datos." };
  }

  await sql`update clients set datos_retenidos_nota = ${nota || null} where id = ${clientId}`;
  await registrarBitacora({
    clientId,
    titulo: "Retención de datos actualizada",
    tipo: "Offboarding",
    contenido: nota || "Nota de retención borrada.",
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Ley 21.719 — elimina los datos personales del contacto a solicitud.
 * Solo sobre un cliente `finalizado` (nunca sobre uno activo/pausado, para
 * no borrar por error el contacto de alguien con quien seguimos operando);
 * el historial operativo (optimizations, log_entries, reports) queda
 * intacto — solo se anonimizan los campos de contacto directo.
 */
export async function eliminarDatosContactoCliente(formData: FormData): Promise<AccionOffboardingResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false, error: "Cliente inválido." };
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede eliminar los datos del contacto." };
  }

  const [cliente] = await sql<{ estado: string }[]>`select estado from clients where id = ${clientId}`;
  if (!cliente) return { ok: false, error: "Cliente inválido." };
  if (cliente.estado !== "finalizado") {
    return { ok: false, error: "Solo se pueden eliminar los datos de contacto de un cliente finalizado." };
  }

  await sql`
    update clients set
      contacto_nombre = 'Eliminado a solicitud',
      contacto_email = '',
      contacto_telefono = null,
      contacto_anonimizado_en = now()
    where id = ${clientId}
  `;
  await registrarBitacora({
    clientId,
    titulo: "Datos del contacto eliminados",
    tipo: "Offboarding",
    contenido: "Datos personales del contacto eliminados a solicitud (Ley 21.719). Historial operativo conservado.",
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
