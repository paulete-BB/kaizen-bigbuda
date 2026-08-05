import { sql } from "@/lib/db";
import { listReunionesDelMes, type ReunionCalendario } from "@/lib/data/meetings";

export interface EventoCalendario {
  id: string;
  clienteId: string;
  clienteNombre: string;
  serviceId: string;
  tipo: string;
  fecha: string;
  hora: string | null;
  estado: string;
  responsable: string | null;
  viernesOrdinal: number | null;
}

export interface HolidayMes {
  fecha: string;
  nombre: string;
}

export async function getMesCalendario(year: number, month: number) {
  const desde = `${year}-${String(month).padStart(2, "0")}-01`;
  const hastaDate = new Date(year, month, 0);
  const hasta = `${hastaDate.getFullYear()}-${String(hastaDate.getMonth() + 1).padStart(2, "0")}-${String(hastaDate.getDate()).padStart(2, "0")}`;

  const [eventos, holidays, reuniones] = await Promise.all([
    sql<
      {
        id: string;
        cliente_id: string;
        cliente_nombre: string;
        service_id: string;
        tipo: string;
        fecha_programada: string;
        hora_programada: string | null;
        estado: string;
        responsable_nombre: string | null;
        viernes_ordinal_asignado: number | null;
      }[]
    >`
      select o.id, c.id as cliente_id, c.nombre as cliente_nombre, o.service_id, o.tipo,
             o.fecha_programada, o.hora_programada, o.estado, u.nombre as responsable_nombre,
             s.viernes_ordinal_asignado
      from optimizations o
      join clients c on c.id = o.client_id
      join services s on s.id = o.service_id
      left join users u on u.id = o.responsable_id
      where o.fecha_programada between ${desde} and ${hasta}
      order by o.fecha_programada, o.hora_programada nulls first
    `,
    sql<HolidayMes[]>`select fecha, nombre from holidays where fecha between ${desde} and ${hasta} order by fecha`,
    listReunionesDelMes(desde, hasta),
  ]);

  const eventosMapeados: EventoCalendario[] = eventos.map((e) => ({
    id: e.id,
    clienteId: e.cliente_id,
    clienteNombre: e.cliente_nombre,
    serviceId: e.service_id,
    tipo: e.tipo,
    fecha: e.fecha_programada,
    hora: e.hora_programada,
    estado: e.estado,
    responsable: e.responsable_nombre,
    viernesOrdinal: e.viernes_ordinal_asignado,
  }));

  return { eventos: eventosMapeados, holidays, reuniones };
}

export type { ReunionCalendario };
