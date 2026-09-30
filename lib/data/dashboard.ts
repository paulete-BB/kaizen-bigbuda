import { sql } from "@/lib/db";
import { fmtFecha, hoySantiago, toIso } from "@/lib/dates";
import { listResponsables, type UsuarioResumen } from "@/lib/data/users";

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

export interface AlertaResponsableAusente {
  optimizationId: string;
  clienteId: string;
  clienteNombre: string;
  detalle: string;
  href: string;
  responsableActualId: string;
  responsableActualNombre: string;
}

export interface DashboardData {
  hoyIso: string;
  cumplimiento: { pct: number; variacionPts: number; aTiempo: number; atrasadas: number; total: number };
  vigencias: { vigentes: number; porVencer: number; vencidos: number; porAtender: number; total: number };
  eventosHoy: EventoResumen[];
  eventosSemana: EventoResumen[];
  responsables: UsuarioResumen[];
  alertas: {
    sinConversiones: AlertaItem[];
    atrasadas: AlertaItem[];
    pacing: AlertaItem[];
    aprobaciones: AlertaItem[];
    bloqueadas: AlertaItem[];
    porVencer: AlertaItem[];
    informesPendientes: AlertaItem[];
    descuentosPorVencer: AlertaItem[];
    syncPendiente: AlertaItem[];
    completadasEnClickUp: AlertaItem[];
    responsableAusente: AlertaResponsableAusente[];
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

  // Secuencial, no `Promise.all`: contra el pooler de Supabase en modo
  // transacción (§4.3), disparar 16 consultas a la vez (como hacía esta
  // función antes) satura las conexiones que Supavisor le da a este
  // proyecto — las consultas en sí corren rápido (confirmado contra
  // producción, <2s cada una), pero varias quedan esperando una conexión
  // que nunca se libera limpiamente y la página entera se cuelga (bug real
  // reportado por el usuario: 504 al abrir /dashboard). Una a la vez usa
  // como máximo una conexión del pool en todo momento — más lento en total
  // (~1-2s extra), pero nunca satura el pooler. Mismo criterio que ya
  // aplicaba el fix de fan-out de Resultados/Gonfernic, esta vez del lado
  // de Postgres en vez de llamadas externas.
  const actual = await cumplimientoDelMes(hoy.getFullYear(), hoy.getMonth() + 1);
  const anterior = await cumplimientoDelMes(
    hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear(),
    hoy.getMonth() === 0 ? 12 : hoy.getMonth(),
  );
  const vigenciasRows = await sql<{ estado: string; total: string }[]>`
    select estado, count(*) as total from (
      select estado from services_view where estado != 'pausado'
      union all
      select estado from discounts_view
    ) x group by estado
  `;
  const eventos = await sql<
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
  `;
  const responsables = await listResponsables();

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

  // Lee el snapshot diario de "ayer" que guarda el cron `snapshot-conversiones-ayer`
  // (§3.7, pedido explícito del usuario) — nunca llama a Meta/GA4 en vivo acá, mismo
  // criterio ya establecido tras el bug de fan-out de Resultados/Gonfernic. Sin
  // snapshot de ayer todavía (cron no corrió, o servicio sin config) → no alerta.
  const sinConversionesRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; periodo_inicio: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, s.tipo, ms.periodo_inicio
    from services s
    join clients c on c.id = s.client_id
    join lateral (
      select datos_json, periodo_inicio from metric_snapshots ms
      where ms.service_id = s.id and ms.periodo_inicio = ms.periodo_fin
      order by ms.obtenido_en desc limit 1
    ) ms on true
    where s.tipo in ('meta_ads', 'google_ads') and not s.pausado
      and (
        (s.tipo = 'meta_ads' and coalesce((ms.datos_json->>'resultados')::numeric, 0) = 0)
        or (s.tipo = 'google_ads' and coalesce((ms.datos_json->>'conversiones')::numeric, 0) = 0)
      )
  `;
  const atrasadasRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_programada: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada
    from optimizations o join clients c on c.id = o.client_id
    where o.estado = 'programada' and o.fecha_programada < current_date
    order by o.fecha_programada
  `;
  const pacingRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; pacing_pct: number }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, s.tipo, b.pacing_pct
    from budgets b join services s on s.id = b.service_id join clients c on c.id = s.client_id
    where b.alerta_disparada and b.mes = ${hoy.getMonth() + 1} and b.anio = ${hoy.getFullYear()}
  `;
  const aprobacionesRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; enviado_en: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, av.tipo, av.enviado_en
    from approvals_view av join clients c on c.id = av.client_id
    where av.estado_efectivo = 'sin_respuesta'
  `;
  const bloqueadasRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; bloqueada_motivo: string | null }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.bloqueada_motivo
    from optimizations o join clients c on c.id = o.client_id
    where o.estado = 'bloqueada'
    order by o.fecha_programada
  `;
  const porVencerRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_termino: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, sv.tipo, sv.fecha_termino
    from services_view sv join clients c on c.id = sv.client_id
    where sv.estado = 'por_vencer'
  `;
  const informesRows = await sql<{ cliente_id: string; cliente_nombre: string; fecha_programada: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, o.fecha_programada
    from optimizations o join clients c on c.id = o.client_id
    where o.tipo = 'seo_aeo_geo' and o.fecha_programada <= current_date
      and o.informe_enviado_en is null and o.estado != 'cancelada'
  `;
  const descuentosRows = await sql<{ cliente_id: string; cliente_nombre: string; descripcion: string; valor: number; fecha_termino: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, dv.descripcion, dv.valor, dv.fecha_termino
    from discounts_view dv join clients c on c.id = dv.client_id
    where dv.estado = 'por_vencer'
  `;
  const syncRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; fecha_programada: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada
    from optimizations o join clients c on c.id = o.client_id
    where o.sync_status != 'ok'
    order by o.fecha_programada desc
  `;
  const completadasClickUpRows = await sql<{ cliente_id: string; cliente_nombre: string; tipo: string; clickup_completada_en: string }[]>`
    select c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.clickup_completada_en
    from optimizations o join clients c on c.id = o.client_id
    where o.clickup_completada_en is not null and o.estado != 'realizada'
    order by o.clickup_completada_en desc
  `;
  // Regla D (§3.2): responsable de una optimización YA programada que está
  // de vacaciones/licencia en esa fecha exacta — join en vivo contra
  // `absences`, no el chequeo del motor (que solo corre al generar). Sin
  // tope de fecha hacia adelante: una ausencia agendada con anticipación
  // debe alertar apenas se registra, no solo cuando se acerca.
  const responsableAusenteRows = await sql<
    {
      optimization_id: string;
      cliente_id: string;
      cliente_nombre: string;
      tipo: string;
      fecha_programada: string;
      responsable_id: string;
      responsable_nombre: string;
    }[]
  >`
    select o.id as optimization_id, c.id as cliente_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada,
           u.id as responsable_id, u.nombre as responsable_nombre
    from optimizations o
    join clients c on c.id = o.client_id
    join users u on u.id = o.responsable_id
    join absences a on a.user_id = o.responsable_id
      and o.fecha_programada between a.fecha_inicio and a.fecha_fin
    where o.estado = 'programada' and o.fecha_programada >= current_date
    order by o.fecha_programada
  `;

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
    responsables,
    alertas: {
      sinConversiones: sinConversionesRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · sin conversiones el ${fmtFecha(r.periodo_inicio)}`,
        href: `/clientes/${r.cliente_id}`,
      })),
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
      aprobaciones: aprobacionesRows.map((r) => {
        const dias = Math.round((hoy.getTime() - new Date(r.enviado_en).getTime()) / 86_400_000);
        return {
          clienteId: r.cliente_id,
          clienteNombre: r.cliente_nombre,
          detalle: `${r.tipo} · ${dias} días sin respuesta`,
          href: `/clientes/${r.cliente_id}`,
        };
      }),
      bloqueadas: bloqueadasRows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · ${r.bloqueada_motivo ?? "bloqueada por aprobación pendiente"}`,
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
      responsableAusente: responsableAusenteRows.map((r) => ({
        optimizationId: r.optimization_id,
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        detalle: `${TIPO_LABEL[r.tipo] ?? r.tipo} · ${r.responsable_nombre} ausente el ${fmtFecha(r.fecha_programada)}`,
        href: `/clientes/${r.cliente_id}`,
        responsableActualId: r.responsable_id,
        responsableActualNombre: r.responsable_nombre,
      })),
    },
  };
}
