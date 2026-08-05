import { sql } from "@/lib/db";

export type ReunionEstado = "programada" | "realizada" | "cancelada";

export interface Reunion {
  id: string;
  clientId: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  estado: ReunionEstado;
  notas: string | null;
}

export async function listReunionesCliente(clientId: string): Promise<Reunion[]> {
  const rows = await sql<
    { id: string; client_id: string; titulo: string; fecha: string; hora: string | null; estado: ReunionEstado; notas: string | null }[]
  >`
    select id, client_id, titulo, fecha, hora, estado, notas
    from meetings where client_id = ${clientId}
    order by fecha desc, hora desc nulls last
  `;
  return rows.map((r) => ({ id: r.id, clientId: r.client_id, titulo: r.titulo, fecha: r.fecha, hora: r.hora, estado: r.estado, notas: r.notas }));
}

export interface ReunionDetalle extends Reunion {
  clienteNombre: string;
}

export async function getReunion(id: string): Promise<ReunionDetalle | null> {
  const [row] = await sql<
    {
      id: string;
      client_id: string;
      cliente_nombre: string;
      titulo: string;
      fecha: string;
      hora: string | null;
      estado: ReunionEstado;
      notas: string | null;
    }[]
  >`
    select m.id, m.client_id, c.nombre as cliente_nombre, m.titulo, m.fecha, m.hora, m.estado, m.notas
    from meetings m join clients c on c.id = m.client_id
    where m.id = ${id}
  `;
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clienteNombre: row.cliente_nombre,
    titulo: row.titulo,
    fecha: row.fecha,
    hora: row.hora,
    estado: row.estado,
    notas: row.notas,
  };
}

export interface ReunionCalendario {
  id: string;
  clienteId: string;
  clienteNombre: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  estado: ReunionEstado;
}

export async function listReunionesDelMes(desde: string, hasta: string): Promise<ReunionCalendario[]> {
  const rows = await sql<
    { id: string; cliente_id: string; cliente_nombre: string; titulo: string; fecha: string; hora: string | null; estado: ReunionEstado }[]
  >`
    select m.id, c.id as cliente_id, c.nombre as cliente_nombre, m.titulo, m.fecha, m.hora, m.estado
    from meetings m join clients c on c.id = m.client_id
    where m.fecha between ${desde} and ${hasta} and m.estado != 'cancelada'
    order by m.fecha, m.hora nulls first
  `;
  return rows.map((r) => ({ id: r.id, clienteId: r.cliente_id, clienteNombre: r.cliente_nombre, titulo: r.titulo, fecha: r.fecha, hora: r.hora, estado: r.estado }));
}
