import { sql } from "@/lib/db";

export interface UsuarioResumen {
  id: string;
  nombre: string;
  iniciales: string;
  color: string;
}

/** Solo usuarios activos — un usuario que ya no trabaja en la agencia (ej. desactivado a mano en `users.activo`) deja de ofrecerse como responsable para trabajo nuevo, sin tocar lo que ya tiene asignado. */
export async function listResponsables(): Promise<UsuarioResumen[]> {
  return sql<UsuarioResumen[]>`select id, nombre, iniciales, color from users where activo order by nombre`;
}
