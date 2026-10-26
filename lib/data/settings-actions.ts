"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncOptimizationTaskToClickUp, type ServicioTipoClickUp } from "@/lib/clickup/client";
import { hoySantiago, toIso } from "@/lib/dates";
import { limitesSemana } from "@/lib/scheduling/ads-semanal";

export interface GuardarAjustesResultado {
  ok: boolean;
  error?: string;
}

export async function guardarAjustes(formData: FormData): Promise<GuardarAjustesResultado> {
  const session = await requireUser();
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede modificar los ajustes." };
  }

  const clickupWorkspaceId = String(formData.get("clickupWorkspaceId") ?? "").trim();
  const clickupDefaultListId = String(formData.get("clickupDefaultListId") ?? "").trim();
  const clickupBitacoraDocId = String(formData.get("clickupBitacoraDocId") ?? "").trim();
  const diasAlertaDescuento = Number(formData.get("diasAlertaDescuento") ?? 15);
  const diasAlertaVencimientoServicio = Number(formData.get("diasAlertaVencimientoServicio") ?? 20);
  const umbralPacingPct = Number(formData.get("umbralPacingPct") ?? 15);
  const diasAlertaAprobacion = Number(formData.get("diasAlertaAprobacion") ?? 3);
  const diasAlertaOnboarding = Number(formData.get("diasAlertaOnboarding") ?? 5);

  if (
    [diasAlertaDescuento, diasAlertaVencimientoServicio, umbralPacingPct, diasAlertaAprobacion, diasAlertaOnboarding].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  ) {
    return { ok: false, error: "Los umbrales deben ser números positivos." };
  }

  await sql`
    update settings set
      clickup_workspace_id = ${clickupWorkspaceId || null},
      clickup_default_list_id = ${clickupDefaultListId || null},
      clickup_bitacora_doc_id = ${clickupBitacoraDocId || null},
      dias_alerta_descuento = ${diasAlertaDescuento},
      dias_alerta_vencimiento_servicio = ${diasAlertaVencimientoServicio},
      umbral_pacing_pct = ${umbralPacingPct},
      dias_alerta_aprobacion = ${diasAlertaAprobacion},
      dias_alerta_onboarding = ${diasAlertaOnboarding}
    where id = 1
  `;

  revalidatePath("/ajustes");
  return { ok: true };
}

const LOTE_RESYNC = 20;

export interface ResincronizarResultado {
  ok: boolean;
  error?: string;
  revisadas: number;
  actualizadas: number;
  fallidas: number;
  /** Tareas que quedan por revisar después de este lote. */
  restantes: number;
}

/**
 * Vuelve a sincronizar con ClickUp las tareas de las optimizaciones aún no
 * realizadas (fecha, etiquetas y responsable), por lotes — útil después de
 * cambiar responsables directo en la base o de corregir el mapeo de
 * usuarios de ClickUp. `syncOptimizationTaskToClickUp` es idempotente
 * (actualiza por `clickup_task_id`), así que repetirlo no duplica nada.
 */
export async function resincronizarTareasClickUp(desde: number): Promise<ResincronizarResultado> {
  const session = await requireUser();
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede resincronizar las tareas.", revisadas: 0, actualizadas: 0, fallidas: 0, restantes: 0 };
  }

  // Las que ya tienen tarea, más las de esta semana que todavía no la tienen (las de semanas futuras esperan a su semana).
  const { lunes, domingo } = limitesSemana(toIso(hoySantiago()));
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from optimizations
    where estado in ('programada', 'bloqueada', 'atrasada') and tipo != 'seo_aeo_geo'
      and (clickup_task_id is not null or fecha_programada between ${lunes} and ${domingo})
  `;
  const filas = await sql<
    { id: string; client_id: string; service_id: string; tipo: ServicioTipoClickUp; fecha_programada: string; hora_programada: string | null; responsable_id: string | null }[]
  >`
    select id, client_id, service_id, tipo, fecha_programada, hora_programada, responsable_id
    from optimizations
    where estado in ('programada', 'bloqueada', 'atrasada') and tipo != 'seo_aeo_geo'
      and (clickup_task_id is not null or fecha_programada between ${lunes} and ${domingo})
    order by fecha_programada, id
    limit ${LOTE_RESYNC} offset ${Math.max(0, desde)}
  `;

  let actualizadas = 0;
  for (const o of filas) {
    const r = await syncOptimizationTaskToClickUp({
      optimizationId: o.id,
      clientId: o.client_id,
      serviceId: o.service_id,
      servicioTipo: o.tipo,
      fechaProgramada: o.fecha_programada,
      horaProgramada: o.hora_programada,
      responsableId: o.responsable_id,
    });
    if (r.ok) actualizadas++;
  }

  return {
    ok: true,
    revisadas: filas.length,
    actualizadas,
    fallidas: filas.length - actualizadas,
    restantes: Math.max(0, total - (Math.max(0, desde) + filas.length)),
  };
}
