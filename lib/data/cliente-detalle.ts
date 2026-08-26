import { sql } from "@/lib/db";
import { hoySantiago, toIso } from "@/lib/dates";

export type ServicioTipo = "seo_aeo_geo" | "meta_ads" | "google_ads";

const SERVICE_COLOR: Record<ServicioTipo, string> = {
  seo_aeo_geo: "var(--color-svc-seo)",
  meta_ads: "#2563eb",
  google_ads: "var(--color-svc-google)",
};

const SERVICE_NOMBRE: Record<ServicioTipo, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export interface ServicioDetalle {
  id: string;
  tipo: ServicioTipo;
  nombre: string;
  color: string;
  inicio: string;
  vigencia: string | null;
  periodo: string | null;
  viernesOrdinal: string | null;
  presupuesto: string | null;
  ritmo: boolean;
  ritmoLabel: string | null;
  pacingPct: number | null;
  gastoAcumulado: number | null;
  presupuestoMensual: number | null;
  pausado: boolean;
}

export interface DescuentoDetalle {
  id: string;
  nombre: string;
  pct: number;
  vence: string;
}

export interface TareaDetalle {
  id: string;
  titulo: string;
  destino: "checklist" | "recurrente";
  frecuencia: string | null;
  svc: "seo" | "google" | "meta";
  who: string;
  whoNombre: string;
}

export interface ConfigApis {
  gscProperty: string | null;
  ga4PropertyId: string | null;
  /** Propiedad GA4 de la landing de Google Ads — distinta de `ga4PropertyId` (sitio principal, usado por SEO/AEO) porque las campañas de Google Ads no apuntan al sitio del cliente sino a una landing con su propio GA4. */
  googleAdsGa4PropertyId: string | null;
  metaAdAccountId: string | null;
  fbPageId: string | null;
  igAccountId: string | null;
  metaTokenKey: string | null;
}

export interface ClienteDetalleCompleto {
  id: string;
  nombre: string;
  empresa: string;
  industria: string | null;
  sitioWeb: string | null;
  estado: "activo" | "pausado" | "finalizado";
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string | null;
  logoIniciales: string;
  proximaOptimizacion: string;
  servicios: ServicioDetalle[];
  serviciosTiposExistentes: ServicioTipo[];
  descuentos: DescuentoDetalle[];
  tareas: TareaDetalle[];
  configApis: ConfigApis;
}

export async function getClienteDetalle(id: string): Promise<ClienteDetalleCompleto | null> {
  const hoy = toIso(hoySantiago());
  const [cliente] = await sql<
    {
      id: string;
      nombre: string;
      empresa: string;
      industria: string | null;
      sitio_web: string | null;
      estado: "activo" | "pausado" | "finalizado";
      contacto_nombre: string;
      contacto_email: string;
      contacto_telefono: string | null;
      gsc_property: string | null;
      ga4_property_id: string | null;
      google_ads_ga4_property_id: string | null;
      meta_ad_account_id: string | null;
      fb_page_id: string | null;
      ig_account_id: string | null;
      meta_token_key: string | null;
    }[]
  >`select id, nombre, empresa, industria, sitio_web, estado, contacto_nombre, contacto_email, contacto_telefono,
       gsc_property, ga4_property_id, google_ads_ga4_property_id, meta_ad_account_id, fb_page_id, ig_account_id, meta_token_key
     from clients where id = ${id}`;
  if (!cliente) return null;

  const hoyDate = hoySantiago();
  const anio = hoyDate.getFullYear();
  const mes = hoyDate.getMonth() + 1;

  const [serviciosRows, descuentosRows, tareasRows, proximaRows] = await Promise.all([
    sql<
      {
        id: string;
        tipo: ServicioTipo;
        fecha_inicio: string;
        fecha_termino: string | null;
        periodo_meses: number | null;
        viernes_ordinal_asignado: number | null;
        presupuesto_mensual: number | null;
        moneda: string | null;
        pacing_pct: number | null;
        gasto_acumulado: number | null;
        alerta_disparada: boolean | null;
        pausado: boolean;
      }[]
    >`
      select s.id, s.tipo, s.fecha_inicio, s.fecha_termino, s.periodo_meses, s.viernes_ordinal_asignado,
             s.presupuesto_mensual, s.moneda, b.pacing_pct, b.gasto_acumulado, b.alerta_disparada, s.pausado
      from services s
      left join budgets b on b.service_id = s.id and b.mes = ${mes} and b.anio = ${anio}
      where s.client_id = ${id}
      order by s.tipo
    `,
    sql<{ id: string; descripcion: string; valor: number; fecha_termino: string }[]>`
      select id, descripcion, valor, fecha_termino from discounts
      where client_id = ${id} and fecha_termino >= ${hoy}
      order by fecha_termino
    `,
    sql<
      { id: string; titulo: string; destino: "checklist" | "recurrente"; frecuencia: string | null; servicio_tipo: ServicioTipo; responsable_id: string | null; responsable_nombre: string | null }[]
    >`
      select ct.id, ct.titulo, ct.destino, ct.frecuencia, ct.servicio_tipo, ct.responsable_id, u.nombre as responsable_nombre
      from client_tasks ct left join users u on u.id = ct.responsable_id
      where ct.client_id = ${id}
      order by ct.creado_en desc
    `,
    sql<{ fecha_programada: string }[]>`
      select fecha_programada from optimizations
      where client_id = ${id} and fecha_programada >= ${hoy} and estado = 'programada'
      order by fecha_programada limit 1
    `,
  ]);

  const svcSlug = (tipo: ServicioTipo): "seo" | "google" | "meta" =>
    tipo === "seo_aeo_geo" ? "seo" : tipo === "google_ads" ? "google" : "meta";

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    empresa: cliente.empresa,
    industria: cliente.industria,
    sitioWeb: cliente.sitio_web,
    estado: cliente.estado,
    contactoNombre: cliente.contacto_nombre,
    contactoEmail: cliente.contacto_email,
    contactoTelefono: cliente.contacto_telefono,
    logoIniciales: cliente.nombre.slice(0, 1).toUpperCase(),
    proximaOptimizacion: proximaRows[0]?.fecha_programada ?? "sin próxima optimización",
    configApis: {
      gscProperty: cliente.gsc_property,
      ga4PropertyId: cliente.ga4_property_id,
      googleAdsGa4PropertyId: cliente.google_ads_ga4_property_id,
      metaAdAccountId: cliente.meta_ad_account_id,
      fbPageId: cliente.fb_page_id,
      igAccountId: cliente.ig_account_id,
      metaTokenKey: cliente.meta_token_key,
    },
    servicios: serviciosRows.map((s) => {
      const ritmo = s.alerta_disparada ?? false;
      const desviacion = s.pacing_pct != null ? s.pacing_pct - 100 : null;
      return {
        id: s.id,
        tipo: s.tipo,
        nombre: SERVICE_NOMBRE[s.tipo],
        color: SERVICE_COLOR[s.tipo],
        inicio: s.fecha_inicio,
        vigencia: s.fecha_termino,
        periodo: s.periodo_meses ? `${s.periodo_meses} meses` : null,
        viernesOrdinal: s.viernes_ordinal_asignado ? `${s.viernes_ordinal_asignado}.º del mes` : null,
        presupuesto: s.presupuesto_mensual
          ? `$${Number(s.presupuesto_mensual).toLocaleString("es-CL")}`
          : null,
        ritmo,
        ritmoLabel: desviacion != null ? `${desviacion >= 0 ? "+" : ""}${desviacion}% sobre ritmo` : null,
        pacingPct: s.pacing_pct,
        gastoAcumulado: s.gasto_acumulado,
        presupuestoMensual: s.presupuesto_mensual,
        pausado: s.pausado,
      };
    }),
    serviciosTiposExistentes: serviciosRows.map((s) => s.tipo),
    descuentos: descuentosRows.map((d) => ({ id: d.id, nombre: d.descripcion, pct: Number(d.valor), vence: d.fecha_termino })),
    tareas: tareasRows.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      destino: t.destino,
      frecuencia: t.frecuencia,
      svc: svcSlug(t.servicio_tipo),
      who: t.responsable_id ?? "",
      whoNombre: t.responsable_nombre ?? "Sin asignar",
    })),
  };
}
