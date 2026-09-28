import { sql } from "@/lib/db";

export interface FeriadoDetalle {
  id: string;
  fecha: string;
  nombre: string;
  anio: number;
}

/** Feriados de Chile (§3.2 D), precargados por año y editables desde /ajustes. */
export async function listFeriados(): Promise<FeriadoDetalle[]> {
  return sql<FeriadoDetalle[]>`select id, fecha, nombre, anio from holidays order by fecha desc`;
}
