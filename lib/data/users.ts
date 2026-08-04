import { sql } from "@/lib/db";

export interface UsuarioResumen {
  id: string;
  nombre: string;
  iniciales: string;
  color: string;
}

export async function listResponsables(): Promise<UsuarioResumen[]> {
  return sql<UsuarioResumen[]>`select id, nombre, iniciales, color from users order by nombre`;
}
