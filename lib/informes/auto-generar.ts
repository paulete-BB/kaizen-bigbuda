import { sql } from "@/lib/db";
import { hoySantiago } from "@/lib/dates";
import { crearInformeInterno } from "@/lib/data/informes-actions";
import type { ServicioTipo } from "@/lib/data/cliente-detalle";

const LOTE = 30;

/**
 * Cuántos días desde el inicio del mes se considera "primera semana"
 * (§3.2: "la plataforma genera el evento 'Confeccionar informe mensual'
 * en la primera semana de cada mes (configurable)"). Sin UI en settings
 * todavía — hardcodeado al default del brief, no hay pedido de hacerlo
 * configurable por ahora.
 */
const DIAS_PRIMERA_SEMANA = 7;

export interface ResultadoAutoGeneracion {
  ads: { evaluados: number; creados: number };
}

/**
 * Genera automáticamente los informes mensuales de Ads (Meta/Google) que
 * ya están "vencidos" (primera semana del mes, sin informe todavía) —
 * corrido por el cron de Vercel (`vercel.json`), una vez al día. El
 * informe de SEO-AEO-GEO no pasa por acá: se genera solo, en el momento,
 * enganchado en `guardarRegistroSeo` (§3.2, "el mismo día" de la
 * optimización) — no tiene sentido esperar a un cron para eso.
 *
 * Un cliente con Meta Ads y Google Ads activos a la vez genera **un solo**
 * informe combinado (`ads_combinado`, §3.4) en vez de los dos de siempre —
 * pedido explícito del usuario. Se resuelve primero (y se excluye del
 * loop de abajo) para no terminar creando el combinado Y uno individual
 * para el mismo cliente el mismo día.
 *
 * Idempotente: cada llamada a `crearInformeInterno` no duplica si el
 * informe ya existe (creado a mano o por una corrida anterior del cron).
 */
export async function generarInformesAutomaticos(): Promise<ResultadoAutoGeneracion> {
  const hoy = hoySantiago();
  if (hoy.getDate() > DIAS_PRIMERA_SEMANA) {
    return { ads: { evaluados: 0, creados: 0 } };
  }

  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  let evaluados = 0;
  let creados = 0;

  const clientesCombinado = await sql<{ client_id: string }[]>`
    select s.client_id
    from services s
    where s.tipo in ('meta_ads', 'google_ads') and not s.pausado
    group by s.client_id
    having count(distinct s.tipo) = 2
  `;
  const idsCombinado = new Set(clientesCombinado.map((c) => c.client_id));
  for (const { client_id } of clientesCombinado) {
    evaluados++;
    try {
      const resultado = await crearInformeInterno(client_id, "ads_combinado", mes, anio, null);
      if (resultado.creado) creados++;
    } catch {
      // un cliente que falla (API caída, etc.) no debe frenar el resto del lote
    }
  }

  const servicios = await sql<{ client_id: string; tipo: ServicioTipo }[]>`
    select s.client_id, s.tipo
    from services s
    where s.tipo in ('meta_ads', 'google_ads') and not s.pausado
      and not exists (
        select 1 from reports r
        where r.client_id = s.client_id and r.tipo = s.tipo::text::report_tipo and r.periodo_mes = ${mes} and r.periodo_anio = ${anio}
      )
    limit ${LOTE}
  `;

  for (const { client_id, tipo } of servicios) {
    if (idsCombinado.has(client_id)) continue; // ya cubierto arriba por el informe combinado — no duplicar
    evaluados++;
    try {
      const resultado = await crearInformeInterno(client_id, tipo, mes, anio, null);
      if (resultado.creado) creados++;
    } catch {
      // un cliente que falla (API caída, etc.) no debe frenar el resto del lote
    }
  }

  return { ads: { evaluados, creados } };
}
