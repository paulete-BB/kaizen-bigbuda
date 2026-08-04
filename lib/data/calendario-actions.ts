"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { fridaysOfMonth } from "@/lib/scheduling/dates";
import { MAX_SEO_POR_VIERNES } from "@/lib/scheduling/seo";

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

  const [optimizacion] = await sql<{ id: string; fecha_programada: string }[]>`
    select id, fecha_programada from optimizations
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
  }

  revalidatePath("/calendario");
  return { ok: true };
}
