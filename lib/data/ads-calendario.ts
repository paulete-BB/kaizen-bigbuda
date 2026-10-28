import { sql } from "@/lib/db";
import { hoySantiago, toIso } from "@/lib/dates";
import { syncOptimizationTaskToClickUp, type ServicioTipoClickUp } from "@/lib/clickup/client";
import { fechasSemanalesAds, limitesSemana } from "@/lib/scheduling/ads-semanal";
import { diaHabilSiguiente, esFeriado } from "@/lib/scheduling/holidays";
import type { Holiday } from "@/lib/scheduling/types";

/**
 * Calendario semanal de Ads (Regla B): cada servicio de Ads activo con día
 * asignado aparece en su día todas las semanas, hasta 4 semanas hacia
 * adelante. Antes solo existía una optimización por servicio (la "próxima",
 * que nacía al completar la anterior), así que el calendario se veía casi
 * vacío aunque todos los servicios tuvieran su día asignado.
 *
 * Idempotente: no inserta si el servicio ya tiene una optimización no
 * cancelada esa semana (cubre las que ya existían y las movidas por feriado) ni si el servicio ya
 * se optimizó esa semana, aunque lo realizado fuera una optimización programada
 * para otra fecha.
 * Un lock de Postgres evita duplicados si dos cargas del calendario corren a
 * la vez. Las filas nacen con `sync_status = 'ok'` y sin tarea de ClickUp a
 * propósito: la tarea se crea recién cuando llega esa semana
 * (`sincronizarTareasSemanaEnCurso`), y así el job de reintento no las toma.
 */
export async function generarOptimizacionesAds(opts: { serviceId?: string; hoy?: string } = {}): Promise<{ creadas: number }> {
  const hoy = opts.hoy ?? toIso(hoySantiago());
  const anio = Number(hoy.slice(0, 4));

  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('generar-optimizaciones-ads'))`;

    const servicios = await tx<{ id: string; client_id: string; tipo: "meta_ads" | "google_ads"; dia: number; responsable_id: string | null }[]>`
      select s.id, s.client_id, s.tipo, s.dia_semana_ads_asignado as dia, s.responsable_id
      from services s join clients c on c.id = s.client_id
      where s.tipo in ('meta_ads', 'google_ads') and not s.pausado and c.estado = 'activo'
        and s.dia_semana_ads_asignado is not null
        ${opts.serviceId ? tx`and s.id = ${opts.serviceId}` : tx``}
    `;
    if (servicios.length === 0) return { creadas: 0 };

    const holidays = await tx<Holiday[]>`select fecha, nombre from holidays where anio in (${anio}, ${anio + 1})`;

    let creadas = 0;
    for (const s of servicios) {
      for (const fecha of fechasSemanalesAds(hoy, s.dia)) {
        const objetivo = esFeriado(fecha, holidays) ? diaHabilSiguiente(fecha, holidays) : fecha;
        const { lunes, domingo } = limitesSemana(fecha);
        const [existe] = await tx`
          select 1 from optimizations
          where service_id = ${s.id} and estado != 'cancelada'
            and (fecha_programada between ${lunes} and ${domingo} or fecha_programada = ${objetivo}
                 or (estado = 'realizada' and fecha_realizada between ${lunes} and ${domingo}))
          limit 1
        `;
        if (existe) continue;
        await tx`
          insert into optimizations (client_id, service_id, tipo, fecha_programada, responsable_id, estado, sync_status)
          values (${s.client_id}, ${s.id}, ${s.tipo}, ${objetivo}, ${s.responsable_id}, 'programada', 'ok')
        `;
        creadas++;
      }
    }
    return { creadas };
  });
}

/** Igual que `generarOptimizacionesAds`, pero nunca lanza: para llamarla al cargar el calendario o el dashboard sin que una falla rompa la página. */
export async function asegurarOptimizacionesAds(): Promise<void> {
  try {
    await generarOptimizacionesAds();
  } catch (e) {
    console.error("asegurarOptimizacionesAds:", e);
  }
}

/** Crea en ClickUp la tarea de las optimizaciones de Ads de esta semana que todavía no la tienen (las de semanas futuras esperan a que llegue su semana). */
export async function sincronizarTareasSemanaEnCurso(): Promise<{ intentadas: number; ok: number }> {
  const { lunes, domingo } = limitesSemana(toIso(hoySantiago()));
  const filas = await sql<
    { id: string; client_id: string; service_id: string; tipo: ServicioTipoClickUp; fecha_programada: string; hora_programada: string | null; responsable_id: string | null }[]
  >`
    select id, client_id, service_id, tipo, fecha_programada, hora_programada, responsable_id
    from optimizations
    where tipo != 'seo_aeo_geo' and estado = 'programada' and clickup_task_id is null
      and fecha_programada between ${lunes} and ${domingo}
    order by fecha_programada, id
    limit 30
  `;
  let ok = 0;
  for (const o of filas) {
    const r = await syncOptimizationTaskToClickUp({
      optimizationId: o.id,
      clientId: o.client_id,
      serviceId: o.service_id,
      servicioTipo: o.tipo,
      fechaProgramada: o.fecha_programada,
      horaProgramada: o.hora_programada,
      responsableId: o.responsable_id,
    });
    if (r.ok) ok++;
  }
  return { intentadas: filas.length, ok };
}
