import { sql } from "@/lib/db";
import type { InformeMarketingContenido, InformeSeoContenido } from "@/lib/informes/tipos";
import type { ServicioTipo } from "@/lib/data/cliente-detalle";

export type { ServicioTipo };

export interface InformeResumen {
  id: string;
  tipo: ServicioTipo;
  periodoMes: number;
  periodoAnio: number;
  estado: "borrador" | "listo" | "enviado";
  actualizadoEn: string;
}

export interface InformeCompleto {
  id: string;
  clientId: string;
  serviceId: string | null;
  tipo: ServicioTipo;
  periodoMes: number;
  periodoAnio: number;
  estado: "borrador" | "listo" | "enviado";
  enviadoEn: string | null;
  destinatario: string | null;
  clienteNombre: string;
  clienteEmpresa: string;
  contactoNombre: string;
  sitioWeb: string | null;
  contenido: InformeSeoContenido | InformeMarketingContenido;
}

export async function listarInformesPorCliente(clientId: string): Promise<InformeResumen[]> {
  const rows = await sql<
    { id: string; tipo: ServicioTipo; periodo_mes: number; periodo_anio: number; estado: "borrador" | "listo" | "enviado"; actualizado_en: string }[]
  >`
    select id, tipo, periodo_mes, periodo_anio, estado, actualizado_en
    from reports
    where client_id = ${clientId}
    order by periodo_anio desc, periodo_mes desc, actualizado_en desc
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    periodoMes: r.periodo_mes,
    periodoAnio: r.periodo_anio,
    estado: r.estado,
    actualizadoEn: r.actualizado_en,
  }));
}

export async function obtenerInforme(id: string): Promise<InformeCompleto | null> {
  const [row] = await sql<
    {
      id: string;
      client_id: string;
      service_id: string | null;
      tipo: ServicioTipo;
      periodo_mes: number;
      periodo_anio: number;
      estado: "borrador" | "listo" | "enviado";
      enviado_en: string | null;
      destinatario: string | null;
      contenido_json: InformeSeoContenido | InformeMarketingContenido;
      cliente_nombre: string;
      cliente_empresa: string;
      contacto_nombre: string;
      sitio_web: string | null;
    }[]
  >`
    select r.id, r.client_id, r.service_id, r.tipo, r.periodo_mes, r.periodo_anio, r.estado, r.enviado_en,
           r.destinatario, r.contenido_json,
           c.nombre as cliente_nombre, c.empresa as cliente_empresa, c.contacto_nombre, c.sitio_web
    from reports r
    join clients c on c.id = r.client_id
    where r.id = ${id}
  `;
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    tipo: row.tipo,
    periodoMes: row.periodo_mes,
    periodoAnio: row.periodo_anio,
    estado: row.estado,
    enviadoEn: row.enviado_en,
    destinatario: row.destinatario,
    clienteNombre: row.cliente_nombre,
    clienteEmpresa: row.cliente_empresa,
    contactoNombre: row.contacto_nombre,
    sitioWeb: row.sitio_web,
    contenido: row.contenido_json,
  };
}
