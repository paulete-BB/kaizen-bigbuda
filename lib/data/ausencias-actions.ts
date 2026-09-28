"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export interface AusenciaResultado {
  ok: boolean;
  error?: string;
}

/** Registrar una ausencia (§3.2 D: "cada usuario puede registrar períodos de vacaciones/licencia"). Cualquier miembro autenticado puede registrar la suya; un admin puede registrar la de cualquiera. */
export async function crearAusencia(formData: FormData): Promise<AusenciaResultado> {
  const session = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!userId || !fechaInicio || !fechaFin) return { ok: false, error: "Faltan campos obligatorios." };
  if (fechaFin < fechaInicio) return { ok: false, error: "La fecha de fin no puede ser anterior al inicio." };
  if (session.rol !== "admin" && userId !== session.userId) {
    return { ok: false, error: "Solo un administrador puede registrar la ausencia de otra persona." };
  }

  await sql`insert into absences (user_id, fecha_inicio, fecha_fin, motivo) values (${userId}, ${fechaInicio}, ${fechaFin}, ${motivo})`;

  revalidatePath("/ajustes");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Eliminar una ausencia — el propio usuario o un admin. */
export async function eliminarAusencia(formData: FormData): Promise<AusenciaResultado> {
  const session = await requireUser();
  const ausenciaId = String(formData.get("ausenciaId") ?? "");
  if (!ausenciaId) return { ok: false, error: "Falta el id." };

  const [ausencia] = await sql<{ user_id: string }[]>`select user_id from absences where id = ${ausenciaId}`;
  if (!ausencia) return { ok: false, error: "No se encontró la ausencia." };
  if (session.rol !== "admin" && ausencia.user_id !== session.userId) {
    return { ok: false, error: "Solo un administrador puede eliminar la ausencia de otra persona." };
  }

  await sql`delete from absences where id = ${ausenciaId}`;

  revalidatePath("/ajustes");
  revalidatePath("/dashboard");
  return { ok: true };
}
