import { sql } from "@/lib/db";
import { fmtFecha, hoySantiago, toIso } from "@/lib/dates";

export interface BitacoraItem {
  id: string;
  titulo: string;
  desc: string;
  tipo: string;
  fecha: string;
  responsable: string | null;
  syncStatus: "ok" | "pendiente_sync" | "error";
}

export interface BitacoraGrupo {
  mes: string;
  items: BitacoraItem[];
}

export interface PendienteBitacora {
  titulo: string;
  detalle: string;
  responsable: string | null;
  href: string;
}

export interface BitacoraCompleta {
  clienteId: string;
  clienteNombre: string;
  stats: { total: number; pendientes: number; informes: number; ultima: string | null };
  pendientes: PendienteBitacora[];
  tipos: string[];
  grupos: BitacoraGrupo[];
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function getBitacoraCompleta(clientId: string): Promise<BitacoraCompleta | null> {
  const [cliente] = await sql<{ nombre: string }[]>`select nombre from clients where id = ${clientId}`;
  if (!cliente) return null;

  const hoy = toIso(hoySantiago());

  const [entradas, atrasadas, informesRow, ultimaRow] = await Promise.all([
    sql<{ id: string; titulo: string; tipo: string; contenido: string; creado_en: string; sync_status: BitacoraItem["syncStatus"]; responsable_nombre: string | null }[]>`
      select le.id, le.titulo, le.tipo, le.contenido, le.creado_en::text as creado_en, le.sync_status, u.nombre as responsable_nombre
      from log_entries le left join users u on u.id = le.creado_por
      where le.client_id = ${clientId}
      order by le.creado_en desc
    `,
    sql<{ tipo: string; fecha_programada: string; responsable_nombre: string | null }[]>`
      select o.tipo, o.fecha_programada, u.nombre as responsable_nombre
      from optimizations o left join users u on u.id = o.responsable_id
      where o.client_id = ${clientId} and o.estado = 'programada' and o.fecha_programada < ${hoy}
      order by o.fecha_programada
    `,
    sql<{ total: string }[]>`select count(*) as total from optimizations where client_id = ${clientId} and informe_enviado_en is not null`,
    sql<{ ultima: string | null }[]>`select max(fecha_realizada)::text as ultima from optimizations where client_id = ${clientId}`,
  ]);

  const TIPO_LABEL: Record<string, string> = { seo_aeo_geo: "SEO · AEO · GEO", meta_ads: "Meta Ads", google_ads: "Google Ads" };

  const items: BitacoraItem[] = entradas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    desc: e.contenido,
    tipo: e.tipo,
    fecha: e.creado_en.slice(0, 10),
    responsable: e.responsable_nombre,
    syncStatus: e.sync_status,
  }));

  const grupoPorMes = new Map<string, BitacoraItem[]>();
  for (const item of items) {
    const [y, m] = item.fecha.split("-").map(Number);
    const key = `${MESES[m - 1]} ${y}`;
    const arr = grupoPorMes.get(key) ?? [];
    arr.push(item);
    grupoPorMes.set(key, arr);
  }

  return {
    clienteId: clientId,
    clienteNombre: cliente.nombre,
    stats: {
      total: items.length,
      pendientes: atrasadas.length,
      informes: Number(informesRow[0]?.total ?? 0),
      ultima: ultimaRow[0]?.ultima ? fmtFecha(ultimaRow[0].ultima) : null,
    },
    pendientes: atrasadas.map((a) => ({
      titulo: `Optimización ${TIPO_LABEL[a.tipo] ?? a.tipo}`,
      detalle: `Atrasada desde el ${fmtFecha(a.fecha_programada)}`,
      responsable: a.responsable_nombre,
      href: `/clientes/${clientId}`,
    })),
    tipos: [...new Set(items.map((i) => i.tipo))],
    grupos: [...grupoPorMes.entries()].map(([mes, items]) => ({ mes, items })),
  };
}

export async function listClientesSimple(): Promise<{ id: string; nombre: string }[]> {
  return sql<{ id: string; nombre: string }[]>`select id, nombre from clients order by nombre`;
}
