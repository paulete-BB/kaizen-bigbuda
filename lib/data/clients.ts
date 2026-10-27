import { sql } from "@/lib/db";
import { getSettings } from "./settings";

export interface PacingResumen {
  estado: "sobregasto" | "subgasto";
  pct: number;
}

export interface ServicioResumenLista {
  tipo: string;
  estado: string;
  /** Hay una optimización `programada` con `fecha_programada` ya pasada — mismo criterio que usa el Dashboard. */
  atrasada: boolean;
  /** Último informe `enviado` de este servicio (cuenta también los informes `ads_combinado`, que cubren Meta + Google a la vez). */
  ultimoInformeEnviado: string | null;
  /** Solo para Ads: desviación de pacing del mes en curso contra `settings.umbralPacingPct` — `null` si no hay `budgets` para este mes o está dentro de rango (sin nada que avisar). */
  pacing: PacingResumen | null;
}

/** Métrica de un solo día — pedido explícito del usuario: nada de comparar ventanas, solo el número del día más reciente disponible. */
export interface KpiDiaCliente {
  valor: number;
  /** Fecha real del dato (no necesariamente "ayer": GSC tiene 2-3 días de retraso de procesamiento). */
  fecha: string;
}

export interface ClienteResumen {
  id: string;
  nombre: string;
  estado: "activo" | "pausado" | "finalizado";
  servicios: ServicioResumenLista[];
  responsables: string[];
  /** Clics de Search Console del día más reciente disponible — null si el cliente no tiene SEO-AEO-GEO contratado, no tiene GSC configurado, o el cron todavía no guardó ningún snapshot. */
  seoClicksDia: KpiDiaCliente | null;
  /** Sesiones desde fuentes de IA (GA4) de ayer — mismos requisitos que `seoClicksDia`. */
  aeoSesionesIADia: KpiDiaCliente | null;
  /** Conversiones reales del sitio (GA4, Paid Social) de ayer — en 0 para clientes con campañas de mensajería (Messenger/WhatsApp), que no generan sesión en el sitio. */
  metaConversionesDia: KpiDiaCliente | null;
  /** Conversiones reales del sitio (GA4, `sessionSource=google` + `sessionMedium=cpc` contra la landing de Google Ads) de ayer. */
  googleConversionesDia: KpiDiaCliente | null;
  /** Fecha de la próxima optimización `programada` (cualquier servicio) — `null` si no hay ninguna futura. */
  proximaOptimizacion: string | null;
  /** Cantidad de aprobaciones (`approvals_view.estado_efectivo = 'sin_respuesta'`) de este cliente. */
  aprobacionesSinRespuesta: number;
  /** % de onboarding completado — `null` si el cliente no tiene ningún checklist de onboarding instanciado, o si ya está 100% (nada que avisar). */
  onboardingPct: number | null;
}

const SERVICE_LABEL: Record<string, string> = {
  seo_aeo_geo: "Posicionamiento",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export { SERVICE_LABEL };

/**
 * Lista de clientes con lo necesario para verse sin entrar a la ficha
 * (pedido explícito de Marcel): vigencia por servicio, si la optimización
 * está atrasada, fecha del último informe enviado, un número de "hoy" por
 * sección (SEO/AEO/Meta Ads/Google Ads) leído de los snapshots que guarda
 * el cron `snapshot-resumen-clientes`, pacing de Ads, aprobaciones sin
 * respuesta, % de onboarding y próxima optimización — todos ya calculados
 * en la base para otras pantallas (Dashboard, ficha de cliente), ninguno
 * requiere una llamada en vivo acá. Tres consultas separadas y
 * SECUENCIALES, no `Promise.all` — mismo fix ya aplicado al Dashboard tras
 * el 504 de producción por agotar el pool del pooler de Supabase.
 */
export async function listClientesResumen(): Promise<ClienteResumen[]> {
  const settings = await getSettings();

  const rows = await sql<
    {
      id: string;
      nombre: string;
      estado: "activo" | "pausado" | "finalizado";
      service_id: string | null;
      tipo: string | null;
      servicio_estado: string | null;
      responsable_nombre: string | null;
      atrasada: boolean | null;
      ultimo_informe_enviado: string | null;
      proxima_optimizacion: string | null;
      aprobaciones_sin_respuesta: string;
      onboarding_pct: string | null;
    }[]
  >`
    select
      c.id, c.nombre, c.estado,
      sv.id as service_id, sv.tipo, sv.estado as servicio_estado, u.nombre as responsable_nombre,
      (sv.id is not null and exists(
        select 1 from optimizations o
        where o.service_id = sv.id and o.estado = 'programada' and o.fecha_programada < current_date
      )) as atrasada,
      (
        select max(r.enviado_en)::date::text from reports r
        where r.client_id = c.id and r.estado = 'enviado' and sv.id is not null
          and (r.tipo::text = sv.tipo::text or (r.tipo::text = 'ads_combinado' and sv.tipo::text in ('meta_ads', 'google_ads')))
      ) as ultimo_informe_enviado,
      (
        select min(o.fecha_programada)::text from optimizations o
        where o.client_id = c.id and o.estado = 'programada' and o.fecha_programada >= current_date
      ) as proxima_optimizacion,
      (
        select count(*) from approvals_view av where av.client_id = c.id and av.estado_efectivo = 'sin_respuesta'
      ) as aprobaciones_sin_respuesta,
      (
        select round(100.0 * count(*) filter (where ci.estado in ('recibido', 'completado')) / nullif(count(*), 0))
        from checklist_items ci
        join checklist_instances inst on inst.id = ci.instance_id
        where inst.client_id = c.id and inst.template_id in (select id from checklist_templates where tipo = 'onboarding')
      ) as onboarding_pct
    from clients c
    left join services_view sv on sv.client_id = c.id
    left join users u on u.id = sv.responsable_id
    order by c.nombre
  `;

  const snapshots = await sql<
    {
      service_id: string;
      tipo: string;
      gsc_valor: number | null;
      gsc_fecha: string | null;
      ga4_sesiones: number | null;
      ga4_conversiones: number | null;
      ga4_fecha: string | null;
      pacing_pct: string | null;
    }[]
  >`
    select s.id as service_id, s.tipo,
      (ms_gsc.datos_json->>'clics')::numeric as gsc_valor, ms_gsc.periodo_inicio::text as gsc_fecha,
      (ms_ga4.datos_json->>'totalSesiones')::numeric as ga4_sesiones,
      (ms_ga4.datos_json->>'conversiones')::numeric as ga4_conversiones,
      ms_ga4.periodo_inicio::text as ga4_fecha,
      b.pacing_pct
    from services s
    left join lateral (
      select datos_json, periodo_inicio from metric_snapshots ms
      where ms.service_id = s.id and ms.fuente = 'gsc' and ms.periodo_inicio = ms.periodo_fin
      order by ms.obtenido_en desc limit 1
    ) ms_gsc on true
    left join lateral (
      select datos_json, periodo_inicio from metric_snapshots ms
      where ms.service_id = s.id and ms.fuente = 'ga4' and ms.periodo_inicio = ms.periodo_fin
      order by ms.obtenido_en desc limit 1
    ) ms_ga4 on true
    left join budgets b on b.service_id = s.id and b.mes = extract(month from current_date) and b.anio = extract(year from current_date)
    where s.tipo in ('seo_aeo_geo', 'meta_ads', 'google_ads') and not s.pausado
  `;

  const kpiPorServicio = new Map<
    string,
    { seo?: KpiDiaCliente; aeo?: KpiDiaCliente; metaGoogle?: KpiDiaCliente; pacing?: PacingResumen }
  >();
  for (const s of snapshots) {
    const entry: { seo?: KpiDiaCliente; aeo?: KpiDiaCliente; metaGoogle?: KpiDiaCliente; pacing?: PacingResumen } = {};
    if (s.gsc_valor !== null && s.gsc_fecha) entry.seo = { valor: s.gsc_valor, fecha: s.gsc_fecha };
    if (s.tipo === "seo_aeo_geo" && s.ga4_sesiones !== null && s.ga4_fecha) entry.aeo = { valor: s.ga4_sesiones, fecha: s.ga4_fecha };
    if (s.tipo !== "seo_aeo_geo" && s.ga4_conversiones !== null && s.ga4_fecha) entry.metaGoogle = { valor: s.ga4_conversiones, fecha: s.ga4_fecha };
    // Mismo criterio que la ficha de cliente (`cliente-detalle.ts`): desviación =
    // pacing_pct - 100, comparada contra el umbral configurado — no se confía en
    // `budgets.alerta_disparada` porque queda desactualizado cuando el gasto real
    // viene de una API en vez de cargarse a mano (ver §3.9 → automático).
    if (s.pacing_pct !== null) {
      const desviacion = Number(s.pacing_pct) - 100;
      if (desviacion > settings.umbralPacingPct) entry.pacing = { estado: "sobregasto", pct: Number(s.pacing_pct) };
      else if (desviacion < -settings.umbralPacingPct) entry.pacing = { estado: "subgasto", pct: Number(s.pacing_pct) };
    }
    kpiPorServicio.set(s.service_id, entry);
  }

  const porCliente = new Map<string, ClienteResumen>();
  for (const r of rows) {
    if (!porCliente.has(r.id)) {
      porCliente.set(r.id, {
        id: r.id,
        nombre: r.nombre,
        estado: r.estado,
        servicios: [],
        responsables: [],
        seoClicksDia: null,
        aeoSesionesIADia: null,
        metaConversionesDia: null,
        googleConversionesDia: null,
        proximaOptimizacion: r.proxima_optimizacion,
        aprobacionesSinRespuesta: Number(r.aprobaciones_sin_respuesta),
        onboardingPct: r.onboarding_pct !== null && Number(r.onboarding_pct) < 100 ? Number(r.onboarding_pct) : null,
      });
    }
    const cliente = porCliente.get(r.id)!;
    if (r.tipo && r.service_id) {
      const kpi = kpiPorServicio.get(r.service_id);
      cliente.servicios.push({
        tipo: r.tipo,
        estado: r.servicio_estado ?? "activo",
        atrasada: !!r.atrasada,
        ultimoInformeEnviado: r.ultimo_informe_enviado,
        pacing: kpi?.pacing ?? null,
      });
      if (kpi?.seo) cliente.seoClicksDia = kpi.seo;
      if (kpi?.aeo) cliente.aeoSesionesIADia = kpi.aeo;
      if (kpi?.metaGoogle && r.tipo === "meta_ads") cliente.metaConversionesDia = kpi.metaGoogle;
      if (kpi?.metaGoogle && r.tipo === "google_ads") cliente.googleConversionesDia = kpi.metaGoogle;
    }
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
