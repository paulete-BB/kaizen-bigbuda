import { sql } from "@/lib/db";

export type FuenteMetrica = "gsc" | "ga4" | "meta";

export interface ResultadoConSnapshot<T> {
  datos: T;
  obtenidoEn: string;
  deCache: boolean;
}

/**
 * Caché y resiliencia de métricas (§3.14): intenta la llamada en vivo y
 * guarda un snapshot con timestamp; si falla, usa el último snapshot
 * cacheado para ese mismo cliente/servicio/fuente/período con aviso de
 * fecha. Cada llamada exitosa inserta una fila nueva (no upsert) — el
 * histórico de snapshots por período es la fuente de datos de la pestaña
 * "Resultados" (§3.15, "el dashboard original no persiste datos").
 */
export async function conCacheDeSnapshot<T>(opts: {
  clientId: string;
  serviceId: string | null;
  fuente: FuenteMetrica;
  periodoInicio: string;
  periodoFin: string;
  fetchLive: () => Promise<T>;
}): Promise<ResultadoConSnapshot<T>> {
  try {
    const datos = await opts.fetchLive();
    const [{ obtenido_en }] = await sql<{ obtenido_en: string }[]>`
      insert into metric_snapshots (client_id, service_id, fuente, periodo_inicio, periodo_fin, datos_json)
      values (${opts.clientId}, ${opts.serviceId}, ${opts.fuente}, ${opts.periodoInicio}, ${opts.periodoFin}, ${sql.json(datos as unknown as Parameters<typeof sql.json>[0])})
      returning obtenido_en
    `;
    return { datos, obtenidoEn: obtenido_en, deCache: false };
  } catch (e) {
    const [snapshot] = await sql<{ datos_json: T; obtenido_en: string }[]>`
      select datos_json, obtenido_en from metric_snapshots
      where client_id = ${opts.clientId} and fuente = ${opts.fuente}
        and periodo_inicio = ${opts.periodoInicio} and periodo_fin = ${opts.periodoFin}
        ${opts.serviceId ? sql`and service_id = ${opts.serviceId}` : sql``}
      order by obtenido_en desc
      limit 1
    `;
    if (!snapshot) throw e;
    return { datos: snapshot.datos_json, obtenidoEn: snapshot.obtenido_en, deCache: true };
  }
}
