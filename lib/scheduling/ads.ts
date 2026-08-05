import { wednesdaysOfMonth } from "./dates";
import { esFeriado, juevesSiguiente } from "./holidays";
import type { Advertencia, Holiday, OptimizacionGenerada, ServicioActivo } from "./types";

export const HORA_BLOQUE_ADS = "16:00";

/**
 * Regla B — un ítem por cada miércoles del mes × cada servicio de Ads activo.
 * Meta Ads y Google Ads del mismo cliente se tratan como ítems separados
 * (no se agrupan). Miércoles feriado → jueves siguiente a las 16:00.
 */
export function generarOptimizacionesAdsDelMes(
  servicios: ServicioActivo[],
  holidays: Holiday[],
  year: number,
  month: number,
): { optimizaciones: OptimizacionGenerada[]; advertencias: Advertencia[] } {
  const wednesdays = wednesdaysOfMonth(year, month);
  const optimizaciones: OptimizacionGenerada[] = [];

  for (const fecha of wednesdays) {
    const feriado = esFeriado(fecha, holidays);
    const fechaFinal = feriado ? juevesSiguiente(fecha) : fecha;

    for (const servicio of servicios) {
      optimizaciones.push({
        clientId: servicio.clientId,
        serviceId: servicio.id,
        tipo: servicio.tipo,
        fechaProgramada: fechaFinal,
        horaProgramada: HORA_BLOQUE_ADS,
        responsableId: servicio.responsableId,
        ...(feriado ? { reprogramada: { fechaOriginal: fecha, motivo: "feriado" as const } } : {}),
      });
    }
  }

  return { optimizaciones, advertencias: [] };
}
