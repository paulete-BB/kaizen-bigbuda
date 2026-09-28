"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncOptimizationTaskToClickUp, type ServicioTipoClickUp } from "@/lib/clickup/client";

export interface ReasignarResponsableResultado {
  ok: boolean;
  error?: string;
}

/**
 * "Reasignar responsable en un clic" (§3.2 D) — típicamente disparado desde
 * la alerta del dashboard cuando el responsable actual está ausente en la
 * fecha programada. Reusa `syncOptimizationTaskToClickUp` (ya idempotente,
 * actualiza la tarea existente por `clickup_task_id`) en vez de escribir una
 * función nueva solo para el assignee.
 */
export async function reasignarResponsableOptimizacion(formData: FormData): Promise<ReasignarResponsableResultado> {
  await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  const responsableId = String(formData.get("responsableId") ?? "");
  if (!optimizationId || !responsableId) return { ok: false, error: "Falta seleccionar un responsable." };

  const [opt] = await sql<
    { client_id: string; service_id: string; tipo: ServicioTipoClickUp; fecha_programada: string; hora_programada: string | null }[]
  >`
    select client_id, service_id, tipo, fecha_programada, hora_programada from optimizations where id = ${optimizationId}
  `;
  if (!opt) return { ok: false, error: "No se encontró la optimización." };

  await sql`update optimizations set responsable_id = ${responsableId} where id = ${optimizationId}`;

  after(() =>
    syncOptimizationTaskToClickUp({
      optimizationId,
      clientId: opt.client_id,
      serviceId: opt.service_id,
      servicioTipo: opt.tipo,
      fechaProgramada: opt.fecha_programada,
      horaProgramada: opt.hora_programada,
      responsableId,
    }),
  );

  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${opt.client_id}`);
  return { ok: true };
}
