"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncLogEntryToClickUp } from "@/lib/clickup/client";
import { TIPOS_APROBACION, TIPO_APROBACION_LABEL, type ApprovalTipo } from "@/lib/approvals-tipos";

export interface AccionAprobacionResultado {
  ok: boolean;
  error?: string;
}

function esTipoValido(v: string): v is ApprovalTipo {
  return (TIPOS_APROBACION as readonly string[]).includes(v);
}

async function registrarBitacoraAprobacion(opts: { clientId: string; titulo: string; contenido: string; creadoPor: string }) {
  const sync = await syncLogEntryToClickUp({
    clientId: opts.clientId,
    fecha: new Date().toISOString().slice(0, 10),
    titulo: opts.titulo,
    tipo: "Aprobación",
    contenido: opts.contenido,
  });
  await sql`
    insert into log_entries (client_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${opts.clientId}, ${opts.titulo}, 'Aprobación', ${opts.contenido}, ${sync.ok ? "ok" : "pendiente_sync"}, ${opts.creadoPor})
  `;
}

export async function crearAprobacion(formData: FormData): Promise<AccionAprobacionResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const canal = String(formData.get("canal") ?? "").trim();
  const optimizationId = String(formData.get("optimizationId") ?? "").trim();
  if (!clientId || !descripcion) return { ok: false, error: "Completa la descripción." };
  if (!esTipoValido(tipo)) return { ok: false, error: "Tipo de aprobación inválido." };

  await sql`
    insert into approvals (client_id, tipo, descripcion, link, canal, optimization_id)
    values (${clientId}, ${tipo}::approval_tipo, ${descripcion}, ${link || null}, ${canal || null}, ${optimizationId || null})
  `;

  if (optimizationId) {
    await sql`
      update optimizations set estado = 'bloqueada', bloqueada_motivo = ${`Aprobación pendiente (${TIPO_APROBACION_LABEL[tipo]}): ${descripcion}`}
      where id = ${optimizationId} and estado = 'programada'
    `;
  }

  await registrarBitacoraAprobacion({
    clientId,
    titulo: `Aprobación solicitada · ${TIPO_APROBACION_LABEL[tipo]}`,
    contenido: descripcion + (link ? `\nLink: ${link}` : ""),
    creadoPor: session.userId,
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function resolverAprobacion(formData: FormData): Promise<AccionAprobacionResultado> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !clientId || (decision !== "aprobado" && decision !== "rechazado")) {
    return { ok: false, error: "Datos inválidos." };
  }

  const [aprobacion] = await sql<{ tipo: ApprovalTipo; descripcion: string; optimization_id: string | null; estado: string }[]>`
    select tipo, descripcion, optimization_id, estado from approvals where id = ${id}
  `;
  if (!aprobacion) return { ok: false, error: "Aprobación no encontrada." };
  if (aprobacion.estado === "aprobado" || aprobacion.estado === "rechazado") {
    return { ok: false, error: "Esta aprobación ya fue resuelta." };
  }

  await sql`update approvals set estado = ${decision}::approval_estado, resuelto_en = current_date where id = ${id}`;

  if (aprobacion.optimization_id) {
    await sql`
      update optimizations set estado = 'programada', bloqueada_motivo = null
      where id = ${aprobacion.optimization_id} and estado = 'bloqueada'
    `;
  }

  await registrarBitacoraAprobacion({
    clientId,
    titulo: `Aprobación ${decision} · ${TIPO_APROBACION_LABEL[aprobacion.tipo]}`,
    contenido: aprobacion.descripcion,
    creadoPor: session.userId,
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  return { ok: true };
}

/** §3.11: "opción de registrar el recordatorio enviado" — no cambia el estado, solo deja constancia. */
export async function registrarRecordatorioAprobacion(formData: FormData): Promise<AccionAprobacionResultado> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!id || !clientId) return { ok: false, error: "Datos inválidos." };

  await sql`insert into approval_reminders (approval_id) values (${id})`;
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function eliminarAprobacion(formData: FormData): Promise<AccionAprobacionResultado> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!id || !clientId) return { ok: false, error: "Aprobación inválida." };
  if (session.rol !== "admin") return { ok: false, error: "Solo un administrador puede eliminar una aprobación." };

  const [aprobacion] = await sql<{ optimization_id: string | null }[]>`select optimization_id from approvals where id = ${id}`;
  if (aprobacion?.optimization_id) {
    await sql`update optimizations set estado = 'programada', bloqueada_motivo = null where id = ${aprobacion.optimization_id} and estado = 'bloqueada'`;
  }
  await sql`delete from approvals where id = ${id}`;
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
