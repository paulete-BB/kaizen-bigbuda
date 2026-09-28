"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { diaHabilSiguiente, viernesAnteriorHabil } from "@/lib/scheduling/holidays";
import { MAX_SEO_POR_VIERNES } from "@/lib/scheduling/seo";
import type { Holiday } from "@/lib/scheduling/types";
import { syncOptimizationTaskToClickUp, type ServicioTipoClickUp } from "@/lib/clickup/client";

export interface FeriadoResultado {
  ok: boolean;
  error?: string;
  reprogramadas?: number;
}

async function proximoViernesConCupo(fechaOriginal: string, holidays: Holiday[]): Promise<string> {
  let candidato = fechaOriginal;
  for (let intentos = 0; intentos < 8; intentos++) {
    candidato = viernesAnteriorHabil(candidato, holidays);
    const [{ total }] = await sql<{ total: string }[]>`
      select count(*) as total from optimizations
      where tipo = 'seo_aeo_geo' and estado = 'programada' and fecha_programada = ${candidato}
    `;
    if (Number(total) < MAX_SEO_POR_VIERNES) return candidato;
  }
  return candidato;
}

/**
 * Reprogramación automática (§3.2 D) de las optimizaciones que ya estaban
 * `programada` justo en la fecha que se acaba de marcar como feriado — misma
 * regla que ya usa el motor al generar (SEO → viernes anterior con cupo,
 * respetando el máx. 2/viernes; Ads → día hábil siguiente, sin tope), pero
 * aplicada retroactivamente sobre filas que ya existían en `optimizations`.
 */
async function reprogramarOptimizacionesPorFeriado(fecha: string, session: { userId: string }): Promise<number> {
  const holidays = await sql<Holiday[]>`select fecha, nombre from holidays`;

  const afectadas = await sql<
    { id: string; tipo: ServicioTipoClickUp; client_id: string; service_id: string; responsable_id: string | null }[]
  >`
    select id, tipo, client_id, service_id, responsable_id from optimizations
    where estado = 'programada' and fecha_programada = ${fecha}
  `;

  for (const opt of afectadas) {
    const nuevaFecha = opt.tipo === "seo_aeo_geo" ? await proximoViernesConCupo(fecha, holidays) : diaHabilSiguiente(fecha, holidays);

    await sql`update optimizations set fecha_programada = ${nuevaFecha} where id = ${opt.id}`;
    await sql`
      insert into reschedules (optimization_id, fecha_original, fecha_nueva, motivo, creado_por)
      values (${opt.id}, ${fecha}, ${nuevaFecha}, 'feriado', ${session.userId})
    `;

    after(() =>
      syncOptimizationTaskToClickUp({
        optimizationId: opt.id,
        clientId: opt.client_id,
        serviceId: opt.service_id,
        servicioTipo: opt.tipo,
        fechaProgramada: nuevaFecha,
        responsableId: opt.responsable_id,
      }),
    );
  }

  return afectadas.length;
}

export async function crearFeriado(formData: FormData): Promise<FeriadoResultado> {
  const session = await requireUser();
  if (session.rol !== "admin") return { ok: false, error: "Solo un administrador puede editar los feriados." };

  const fecha = String(formData.get("fecha") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!fecha || !nombre) return { ok: false, error: "Faltan campos obligatorios." };
  const anio = Number(fecha.slice(0, 4));

  try {
    await sql`insert into holidays (fecha, nombre, anio) values (${fecha}, ${nombre}, ${anio})`;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") return { ok: false, error: "Ya existe un feriado registrado en esa fecha." };
    throw err;
  }

  const reprogramadas = await reprogramarOptimizacionesPorFeriado(fecha, session);

  revalidatePath("/ajustes");
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  return { ok: true, reprogramadas };
}

export async function eliminarFeriado(formData: FormData): Promise<FeriadoResultado> {
  const session = await requireUser();
  if (session.rol !== "admin") return { ok: false, error: "Solo un administrador puede editar los feriados." };

  const feriadoId = String(formData.get("feriadoId") ?? "");
  if (!feriadoId) return { ok: false, error: "Falta el id." };

  await sql`delete from holidays where id = ${feriadoId}`;

  revalidatePath("/ajustes");
  return { ok: true };
}
