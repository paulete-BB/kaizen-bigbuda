import { sql } from "@/lib/db";

export interface BitacoraEntrada {
  id: string;
  titulo: string;
  desc: string;
  tipo: string;
  cuando: string;
  responsable: string | null;
  syncStatus: "ok" | "pendiente_sync" | "error";
}

export async function getBitacoraCliente(clientId: string, limit = 20): Promise<BitacoraEntrada[]> {
  const rows = await sql<
    { id: string; titulo: string; tipo: string; contenido: string; creado_en: string; sync_status: "ok" | "pendiente_sync" | "error"; responsable_nombre: string | null }[]
  >`
    select le.id, le.titulo, le.tipo, le.contenido, le.creado_en::text as creado_en, le.sync_status,
           u.nombre as responsable_nombre
    from log_entries le left join users u on u.id = le.creado_por
    where le.client_id = ${clientId}
    order by le.creado_en desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    desc: r.contenido,
    tipo: r.tipo,
    cuando: r.creado_en,
    responsable: r.responsable_nombre,
    syncStatus: r.sync_status,
  }));
}
