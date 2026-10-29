import { sql } from "@/lib/db";
import { hoySantiago, toIso } from "@/lib/dates";
import { limitesSemana } from "@/lib/scheduling/ads-semanal";

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
  /** Solo servicios de Ads: fecha de la última optimización realizada (para no repetir tareas ya hechas). */
  ultimaOptimizacion: string | null;
  /** Solo servicios de Ads: la optimización de esta semana a trabajar (o la pendiente más cercana). */
  optimizacionActual: { id: string; fecha: string; agenteEstado: "en_curso" | "cerrada" | null } | null;
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
  /** Propiedad GA4 de la landing de Meta Ads, cuando el cliente no manda tráfico de Meta al sitio principal (caso excepcional — a diferencia de Google Ads, la mayoría de los clientes sí apuntan Meta al sitio, por eso este campo tiene fallback a `ga4PropertyId` en vez de ser obligatorio). */
  metaAdsGa4PropertyId: string | null;
  metaAdAccountId: string | null;
  fbPageId: string | null;
  igAccountId: string | null;
  metaTokenKey: string | null;
  /** ID de la cuenta de Google Ads del cliente (10 dígitos, sin guiones) para la API de Google Ads. */
  googleAdsCustomerId: string | null;
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
  /** Id de la próxima optimización SEO-AEO-GEO `programada` de este cliente, si tiene una — usado para armar el link real de "Registrar optimización" (§3.2: SEO se registra desde acá; Ads se trabaja desde la tarjeta de cada servicio, ver `ServicioDetalle.optimizacionActual`). */
  proximaOptimizacionSeoId: string | null;
  servicios: ServicioDetalle[];
  serviciosTiposExistentes: ServicioTipo[];
  descuentos: DescuentoDetalle[];
  tareas: TareaDetalle[];
  configApis: ConfigApis;
  /** Retención de datos y anonimización de contacto (§3.12 / Ley 21.719). */
  datosRetenidosNota: string | null;
  contactoAnonimizadoEn: string | null;
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
      meta_ads_ga4_property_id: string | null;
      meta_ad_account_id: string | null;
      fb_page_id: string | null;
      ig_account_id: string | null;
      meta_token_key: string | null;
      google_ads_customer_id: string | null;
      datos_retenidos_nota: string | null;
      contacto_anonimizado_en: string | null;
    }[]
  >`select id, nombre, empresa, industria, sitio_web, estado, contacto_nombre, contacto_email, contacto_telefono,
       gsc_property, ga4_property_id, google_ads_ga4_property_id, meta_ads_ga4_property_id, meta_ad_account_id, fb_page_id, ig_account_id, meta_token_key, google_ads_customer_id,
       datos_retenidos_nota,
       to_char(contacto_anonimizado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as contacto_anonimizado_en
     from clients where id = ${id}`;
  if (!cliente) return null;

  const hoyDate = hoySantiago();
  const anio = hoyDate.getFullYear();
  const mes = hoyDate.getMonth() + 1;

  const [serviciosRows, descuentosRows, tareasRows, proximaRows, proximaSeoRows] = await Promise.all([
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
    sql<{ id: string }[]>`
      select id from optimizations
      where client_id = ${id} and tipo = 'seo_aeo_geo' and estado = 'programada'
      order by fecha_programada limit 1
    `,
  ]);

  // Por servicio de Ads: última optimización realizada y la que toca trabajar (secuencial, no Promise.all: ver bug del pooler).
  const ultimas = await sql<{ service_id: string; ultima: string }[]>`
    select service_id, max(fecha_realizada)::text as ultima from optimizations
    where client_id = ${id} and estado = 'realizada' and tipo != 'seo_aeo_geo' group by service_id
  `;
  const pendientes = await sql<{ id: string; service_id: string; fecha_programada: string; agente_estado: "en_curso" | "cerrada" | null }[]>`
    select o.id, o.service_id, o.fecha_programada, ag.estado as agente_estado
    from optimizations o left join agent_sessions ag on ag.optimization_id = o.id
    where o.client_id = ${id} and o.tipo != 'seo_aeo_geo' and o.estado in ('programada', 'bloqueada')
    order by o.fecha_programada
  `;
  const { lunes, domingo } = limitesSemana(hoy);
  const ultimaPorServicio = new Map(ultimas.map((u) => [u.service_id, u.ultima]));
  /** La de esta semana; si no hay, la pendiente más reciente que ya pasó; si tampoco, la próxima. Las vencidas viejas no importan. */
  function actualDe(serviceId: string) {
    const del = pendientes.filter((p) => p.service_id === serviceId);
    const estaSemana = del.find((p) => p.fecha_programada >= lunes && p.fecha_programada <= domingo);
    const pasadas = del.filter((p) => p.fecha_programada < lunes);
    const elegida = estaSemana ?? pasadas[pasadas.length - 1] ?? del.find((p) => p.fecha_programada > domingo);
    return elegida ? { id: elegida.id, fecha: elegida.fecha_programada, agenteEstado: elegida.agente_estado } : null;
  }

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
    proximaOptimizacionSeoId: proximaSeoRows[0]?.id ?? null,
    configApis: {
      gscProperty: cliente.gsc_property,
      ga4PropertyId: cliente.ga4_property_id,
      googleAdsGa4PropertyId: cliente.google_ads_ga4_property_id,
      metaAdsGa4PropertyId: cliente.meta_ads_ga4_property_id,
      metaAdAccountId: cliente.meta_ad_account_id,
      fbPageId: cliente.fb_page_id,
      igAccountId: cliente.ig_account_id,
      metaTokenKey: cliente.meta_token_key,
      googleAdsCustomerId: cliente.google_ads_customer_id,
    },
    datosRetenidosNota: cliente.datos_retenidos_nota,
    contactoAnonimizadoEn: cliente.contacto_anonimizado_en,
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
        ultimaOptimizacion: ultimaPorServicio.get(s.id) ?? null,
        optimizacionActual: s.tipo === "seo_aeo_geo" || s.pausado ? null : actualDe(s.id),
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
