import { sql } from "@/lib/db";

export interface ClienteResumen {
  id: string;
  nombre: string;
  estado: "activo" | "pausado" | "finalizado";
  servicios: { tipo: string; estado: string }[];
  responsables: string[];
}

const SERVICE_LABEL: Record<string, string> = {
  seo_aeo_geo: "Posicionamiento",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export { SERVICE_LABEL };

export async function listClientesResumen(): Promise<ClienteResumen[]> {
  const rows = await sql<
    {
      id: string;
      nombre: string;
      estado: "activo" | "pausado" | "finalizado";
      tipo: string | null;
      servicio_estado: string | null;
      responsable_nombre: string | null;
    }[]
  >`
    select c.id, c.nombre, c.estado, sv.tipo, sv.estado as servicio_estado, u.nombre as responsable_nombre
    from clients c
    left join services_view sv on sv.client_id = c.id
    left join users u on u.id = sv.responsable_id
    order by c.nombre
  `;

  const porCliente = new Map<string, ClienteResumen>();
  for (const r of rows) {
    if (!porCliente.has(r.id)) {
      porCliente.set(r.id, { id: r.id, nombre: r.nombre, estado: r.estado, servicios: [], responsables: [] });
    }
    const cliente = porCliente.get(r.id)!;
    if (r.tipo) cliente.servicios.push({ tipo: r.tipo, estado: r.servicio_estado ?? "activo" });
    if (r.responsable_nombre && !cliente.responsables.includes(r.responsable_nombre)) {
      cliente.responsables.push(r.responsable_nombre);
    }
  }
  return [...porCliente.values()];
}

export interface ServicioActivoOpcion {
  id: string;
  clienteId: string;
  clienteNombre: string;
  tipo: string;
  fechaTermino: string | null;
}

export async function listServiciosActivosConCliente(): Promise<ServicioActivoOpcion[]> {
  const rows = await sql<{ id: string; cliente_id: string; cliente_nombre: string; tipo: string; fecha_termino: string | null }[]>`
    select s.id, c.id as cliente_id, c.nombre as cliente_nombre, s.tipo, s.fecha_termino
    from services s join clients c on c.id = s.client_id
    where not s.pausado
    order by c.nombre
  `;
  return rows.map((r) => ({ id: r.id, clienteId: r.cliente_id, clienteNombre: r.cliente_nombre, tipo: r.tipo, fechaTermino: r.fecha_termino }));
}

export interface AjusteReciente {
  descripcion: string;
  autor: string | null;
  fecha: string;
  color: string;
}

export async function listAjustesRecientes(limit = 5): Promise<AjusteReciente[]> {
  const [renovaciones, descuentos] = await Promise.all([
    sql<{ descripcion: string; autor: string | null; fecha: string }[]>`
      select c.nombre || ' · extensión de servicio hasta ' || sr.nueva_fecha_termino as descripcion,
             u.nombre as autor, sr.creado_en::text as fecha
      from service_renewals sr
      join services s on s.id = sr.service_id
      join clients c on c.id = s.client_id
      left join users u on u.id = sr.creado_por
      order by sr.creado_en desc limit ${limit}
    `,
    sql<{ descripcion: string; autor: string | null; fecha: string }[]>`
      select c.nombre || ' · nuevo descuento −' || d.valor || '%' as descripcion,
             null as autor, d.creado_en::text as fecha
      from discounts d join clients c on c.id = d.client_id
      order by d.creado_en desc limit ${limit}
    `,
  ]);

  return [
    ...renovaciones.map((r) => ({ ...r, color: "var(--color-success)" })),
    ...descuentos.map((r) => ({ ...r, color: "var(--color-warning)" })),
  ]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, limit);
}
