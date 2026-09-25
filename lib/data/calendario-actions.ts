"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { fridaysOfMonth } from "@/lib/scheduling/dates";
import { MAX_SEO_POR_VIERNES } from "@/lib/scheduling/seo";
import { syncOptimizationTaskToClickUp } from "@/lib/clickup/client";

export interface ReasignarResultado {
  ok: boolean;
  error?: string;
}

/** Drag & drop en el calendario: mueve un cliente SEO a otro viernes ordinal, de forma estable (regla A). */
export async function reasignarViernesSeo(
  serviceId: string,
  nuevoOrdinal: number,
  year: number,
  month: number,
): Promise<ReasignarResultado> {
  const session = await requireUser();

  const [ocupacion] = await sql<{ total: string }[]>`
    select count(*) as total from services
    where tipo = 'seo_aeo_geo' and not pausado and viernes_ordinal_asignado = ${nuevoOrdinal} and id != ${serviceId}
  `;
  if (Number(ocupacion.total) >= MAX_SEO_POR_VIERNES) {
    return { ok: false, error: `Ese viernes ya tiene ${MAX_SEO_POR_VIERNES} clientes asignados.` };
  }

  const fridays = fridaysOfMonth(year, month);
  const nuevaFecha = fridays[nuevoOrdinal - 1];
  if (!nuevaFecha) return { ok: false, error: "Ese mes no tiene ese viernes." };

  const [optimizacion] = await sql<{ id: string; fecha_programada: string; client_id: string; responsable_id: string | null }[]>`
    select id, fecha_programada, client_id, responsable_id from optimizations
    where service_id = ${serviceId} and estado = 'programada'
      and extract(year from fecha_programada) = ${year} and extract(month from fecha_programada) = ${month}
  `;

  await sql`update services set viernes_ordinal_asignado = ${nuevoOrdinal} where id = ${serviceId}`;

  if (optimizacion) {
    await sql`update optimizations set fecha_programada = ${nuevaFecha} where id = ${optimizacion.id}`;
    await sql`
      insert into reschedules (optimization_id, fecha_original, fecha_nueva, motivo, creado_por)
      values (${optimizacion.id}, ${optimizacion.fecha_programada}, ${nuevaFecha}, 'manual', ${session.userId})
    `;
    // `after()`: la tarea ya quedó con su fecha real en la base (arriba); el
    // sync a ClickUp corre después de responder para que el drag & drop no
    // se quede esperando la API de ClickUp (podía tardar ~30-40s si estaba
    // lenta) — si falla, `syncOptimizationTaskToClickUp` deja la fila en
    // `pendiente_sync` para el cron de reintento (§4.3).
    after(() =>
      syncOptimizationTaskToClickUp({
        optimizationId: optimizacion.id,
        clientId: optimizacion.client_id,
        serviceId,
        servicioTipo: "seo_aeo_geo",
        fechaProgramada: nuevaFecha,
        responsableId: optimizacion.responsable_id,
      }),
    );
  }

  revalidatePath("/calendario");
  return { ok: true };
}
