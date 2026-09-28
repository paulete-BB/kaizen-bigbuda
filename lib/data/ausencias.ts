import { sql } from "@/lib/db";

export interface Ausencia {
  id: string;
  userId: string;
  usuarioNombre: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
}

/** Todas las ausencias registradas (§3.2 D), más recientes primero — sin filtrar por usuario, es un panel de equipo. */
export async function listAusencias(): Promise<Ausencia[]> {
  const rows = await sql<
    { id: string; user_id: string; usuario_nombre: string; fecha_inicio: string; fecha_fin: string; motivo: string | null }[]
  >`
    select a.id, a.user_id, u.nombre as usuario_nombre, a.fecha_inicio, a.fecha_fin, a.motivo
    from absences a
    join users u on u.id = a.user_id
    order by a.fecha_inicio desc
  `;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    usuarioNombre: r.usuario_nombre,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    motivo: r.motivo,
  }));
}
