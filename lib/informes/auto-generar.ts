import { sql } from "@/lib/db";
import { hoySantiago } from "@/lib/dates";
import { DIA_EMISION_INFORMES } from "@/lib/config";
import { crearInformeInterno } from "@/lib/data/informes-actions";
import type { ServicioTipo } from "@/lib/data/cliente-detalle";

export interface ResultadoAutoGeneracion {
  evaluados: number;
  creados: number;
}

/**
 * Genera los informes mensuales de todos los servicios de los clientes
 * activos — corrido por el cron de Vercel una vez al día. Desde el día
 * `DIA_EMISION_INFORMES` de cada mes crea, si todavía no existe, el borrador
 * del mes con los datos automáticos (mismos que la pestaña Resultados); los
 * insights se completan después con Claude desde el editor del informe.
 *
 * - SEO · AEO · GEO: un informe por cliente con ese servicio activo.
 * - Meta Ads + Google Ads: un cliente con ambos servicios activos recibe un
 *   solo informe combinado (`ads_combinado`); con uno solo, el individual.
 *
 * Idempotente (índice único cliente/tipo/período): el cron puede correr todos
 * los días sin duplicar nada. Un cliente que falla no frena al resto.
 */
export async function generarInformesAutomaticos(): Promise<ResultadoAutoGeneracion> {
  const hoy = hoySantiago();
  if (hoy.getDate() < DIA_EMISION_INFORMES) return { evaluados: 0, creados: 0 };

  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  let evaluados = 0;
  let creados = 0;

  const activos = await sql<{ client_id: string; tipo: ServicioTipo }[]>`
    select s.client_id, s.tipo
    from services s join clients c on c.id = s.client_id
    where not s.pausado and c.estado = 'activo'
  `;
  const porCliente = new Map<string, Set<ServicioTipo>>();
  for (const { client_id, tipo } of activos) {
    if (!porCliente.has(client_id)) porCliente.set(client_id, new Set());
    porCliente.get(client_id)!.add(tipo);
  }

  const pedidos: { clientId: string; tipo: "seo_aeo_geo" | "meta_ads" | "google_ads" | "ads_combinado" }[] = [];
  for (const [clientId, tipos] of porCliente) {
    if (tipos.has("seo_aeo_geo")) pedidos.push({ clientId, tipo: "seo_aeo_geo" });
    if (tipos.has("meta_ads") && tipos.has("google_ads")) pedidos.push({ clientId, tipo: "ads_combinado" });
    else if (tipos.has("meta_ads")) pedidos.push({ clientId, tipo: "meta_ads" });
    else if (tipos.has("google_ads")) pedidos.push({ clientId, tipo: "google_ads" });
  }

  for (const { clientId, tipo } of pedidos) {
    evaluados++;
    try {
      const resultado = await crearInformeInterno(clientId, tipo, mes, anio, null);
      if (resultado.creado) creados++;
    } catch {
      // un cliente que falla (API caída, etc.) no debe frenar el resto del lote
    }
  }

  return { evaluados, creados };
}
