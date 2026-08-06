import { sql } from "@/lib/db";
import { fmtFecha, hoySantiago, toIso } from "@/lib/dates";

export interface EventoResumen {
  id: string;
  clienteId: string;
  clienteNombre: string;
  tipo: string;
  fecha: string;
  hora: string | null;
  responsable: string | null;
  estado: string;
  informeEnviado: boolean;
}

export interface AlertaItem {
  clienteId: string;
  clienteNombre: string;
  detalle: string;
  href: string;
}

export interface DashboardData {
  hoyIso: string;
  cumplimiento: { pct: number; variacionPts: number; aTiempo: number; atrasadas: number; total: number };
  vigencias: { vigentes: number; porVencer: number; vencidos: number; porAtender: number; total: number };
  eventosHoy: EventoResumen[];
  eventosSemana: EventoResumen[];
  alertas: {
    atrasadas: AlertaItem[];
    pacing: AlertaItem[];
    aprobaciones: AlertaItem[];
    porVencer: AlertaItem[];
    informesPendientes: AlertaItem[];
    descuentosPorVencer: AlertaItem[];
    syncPendiente: AlertaItem[];
    completadasEnClickUp: AlertaItem[];
  };
}

const TIPO_LABEL: Record<string, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

async function cumplimientoDelMes(year: number, month: number) {
  const [row] = await sql<{ total: string; a_tiempo: string; atrasadas: string }[]>`
    select
      count(*) filter (where fecha_programada <= current_date) as total,
      count(*) filter (where estado = 'realizada' and fecha_programada <= current_date) as a_tiempo,
      count(*) filter (where estado = 'programada' and fecha_programada < current_date) as atrasadas
    from optimizations
    where extract(year from fecha_programada) = ${year} and extract(month from fecha_programada) = ${month}
  `;
  const total = Number(row.total);
  const aTiempo = Number(row.a_tiempo);
  const atrasadas = Number(row.atrasadas);
  return { total, aTiempo, atrasadas, pct: total > 0 ? Math.round((aTiempo / total) * 100) : 0 };
}

export async function getDashboardData(): Promise<DashboardData> {
  const hoy = hoySantiago();
  const hoyIso = toIso(hoy);
  const semanaHastaIso = toIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 6));

  const [actual, anterior, vigenciasRows, eventos, settingsRow] = await Promise.all([
    cumplimientoDelMes(hoy.getFullYear(), hoy.getMonth() + 1),
    cumplimientoDelMes(
      hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear(),
      hoy.getMonth() === 0 ? 12 : hoy.getMonth(),
    ),
    sql<{ estado: string; total: string }[]>`
      select estado, count(*) as total from (
        select estado from services_view where estado != 'pausado'
        union all
        select estado from discounts_view
      ) x group by estado
    `,
    sql<
      {
        id: string;
        tipo: string;
        fecha_programada: string;
        hora_programada: string | null;
        estado: string;
        informe_enviado_en: string | null;
        cliente_id: string;
        cliente_nombre: string;
        responsable_nombre: string | null;
      }[]
    >`
      select o.id, o.tipo, o.fecha_programada, o.hora_programada, o.estado, o.informe_enviado_en,
             c.id as cliente_id, c.nombre as cliente_nombre, u.nombre as responsable_nombre
      from optimizations o
      join clients c on c.id = o.client_id
      left join users u on u.id = o.responsable_id
      where o.fecha_programada between ${hoyIso} and ${semanaHastaIso}
      order by o.fecha_programada, o.hora_programada nulls first
    `,
    sql<{ dias_alerta_aprobacion: number }[]>`select dias_alerta_aprobacion from settings where id = 1`,
  ]);

  const diasAlertaAprobacion = settingsRow[0]?.dias_alerta_aprobacion ?? 3;
  const porEstado = new Map(vigenciasRows.map((r) => [r.estado, Number(r.total)]));
  const vigentes = porEstado.get("activo") ?? 0;
  const porVencer = porEstado.get("por_vencer") ?? 0;
  const vencidos = porEstado.get("vencido") ?? 0;

  const eventosMapeados: EventoResumen[] = eventos.map((e) => ({
    id: e.id,
    clienteId: e.cliente_id,
    clienteNombre: e.cliente_nombre,
    tipo: TIPO_LABEL[e.tipo] ?? e.tipo,
    fecha: e.fecha_programada,
    hora: e.hora_programada,
    responsable: e.responsable_nombre,
    estado: e.estado,
    informeEnviado: !!e.informe_enviado_en,
  }));

  const [atrasadasRows, pacingRows, aprobacionesRows, porVencerRows, informesRows, descuentosRows, syncRows, completadasClickUpRows] =
    await Promise.all([
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_programada: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada
        from optimizations o join clients c on c.id = o.client_id
        where o.estado = 'programada' and o.fecha_programada < current_date
        order by o.fecha_programada
      `,
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; pacing_pct: number }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, s.tipo, b.pacing_pct
        from budgets b join services s on s.id = b.service_id join clients c on c.id = s.client_id
        where b.alerta_disparada and b.mes = ${hoy.getMonth() + 1} and b.anio = ${hoy.getFullYear()}
      `,
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; enviado_en: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, a.tipo, a.enviado_en
        from approvals a join clients c on c.id = a.client_id
        where a.estado = 'sin_respuesta'
      `,
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_termino: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, sv.tipo, sv.fecha_termino
        from services_view sv join clients c on c.id = sv.client_id
        where sv.estado = 'por_vencer'
      `,
      sql<{ cliente_id: string; cliente_nombre: string; fecha_programada: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, o.fecha_programada
        from optimizations o join clients c on c.id = o.client_id
        where o.tipo = 'seo_aeo_geo' and o.fecha_programada <= current_date
          and o.informe_enviado_en is null and o.estado != 'cancelada'
      `,
      sql<{ cliente_id: string; cliente_nombre: string; descripcion: string; valor: number; fecha_termino: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, dv.descripcion, dv.valor, dv.fecha_termino
        from discounts_view dv join clients c on c.id = dv.client_id
        where dv.estado = 'por_vencer'
      `,
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_programada: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada
        from optimizations o join clients c on c.id = o.client_id
        where o.sync_status != 'ok'
        order by o.fecha_programada desc
      `,
      sql<{ cliente_id: string; cliente_nombre: string; tipo: string; clickup_completada_en: string }[]>`
        select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.clickup_completada_en
        from optimizations o join clients c on c.id = o.client_id
        where o.clickup_completada_en is not null and o.estado != 'realizada'
        order by o.clickup_completada_en desc
      `,
    ]);

  return {
    hoyIso,
    cumplimiento: {
      pct: actual.pct,
      variacionPts: actual.total > 0 ? actual.pct - anterior.pct : 0,
      aTiempo: actual.aTiempo,
      atrasadas: actual.atrasadas,
      total: actual.total,
    },
    vigencias: {
      vigentes,
      porVencer,
      vencidos,
      porAtender: porVencer + vencidos,
      total: vigentes + porVencer + vencidos,
    },
    eventosHoy: eventosMapeados.filter((e) => e.fecha === hoyIso),
    eventosSemana: eventosMapeados.filter((e) => e.fecha !== hoyIso),
    alertas: {
      atrasadas: atrasadasRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · vencía el ${fmtFecha(r.fecha_programada)}`,
        href: `/clientes/${r.cliente_id}`,
      })),
      pacing: pacingRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · ${r.pacing_pct > 100 ? "+" : ""}${r.pacing_pct - 100}% sobre ritmo`,
        href: `/clientes/${r.cliente_id}`,
      })),
      aprobaciones: aprobacionesRows
        .map((r) => ({
          ...r,
          dias: Math.round((hoy.getTime() - new Date(r.enviado_en).getTime()) / 86_400_000),
        }))
        .filter((r) => r.dias >= diasAlertaAprobacion)
        .map((r) => ({
          clienteId: r.cliente_id,
          clienteNombre: r.cliente_nombre,
          detalle: `${r.tipo} · ${r.dias} días sin respuesta`,
          href: `/clientes/${r.cliente_id}`,
        })),
      porVencer: porVencerRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · vence ${fmtFecha(r.fecha_termino)}`,
        href: `/clientes/${r.cliente_id}`,
      })),
      informesPendientes: informesRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `Informe SEO del ${fmtFecha(r.fecha_programada)} sin enviar`,
        href: `/clientes/${r.cliente_id}`,
      })),
      descuentosPorVencer: descuentosRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${r.descripcion} −${r.valor}% · termina ${fmtFecha(r.fecha_termino)}`,
        href: `/clientes/${r.cliente_id}`,
      })),
      syncPendiente: syncRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · ${fmtFecha(r.fecha_programada)}`,
        href: `/clientes/${r.cliente_id}`,
      })),
      completadasEnClickUp: completadasClickUpRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · completada en ClickUp, falta registrar`,
        href: `/clientes/${r.cliente_id}`,
      })),
    },
  };
}
