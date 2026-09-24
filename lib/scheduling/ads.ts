import { weekdayDatesOfMonth } from "./dates";
import { diaHabilSiguiente, esFeriado } from "./holidays";
import type { AsignacionDiaSemana, Holiday, OptimizacionGenerada, ServicioActivo } from "./types";

export const PRIMER_DIA_SEMANA_ADS = 1; // lunes
export const ULTIMO_DIA_SEMANA_ADS = 5; // viernes

/**
 * Regla B — cada servicio de Ads activo (Meta/Google, tratados por separado
 * incluso del mismo cliente) se revisa una vez por semana, en SU día de la
 * semana asignado (lunes a viernes — viernes ya no es exclusivo de SEO),
 * sin hora fija. Mismo patrón bucket-fill estable que `asignarViernesOrdinal`
 * (Regla A): un servicio ya asignado nunca se mueve solo, sin tope máximo
 * por día (a diferencia del "máx. 2 por viernes" de SEO, no pedido acá).
 */
export function asignarDiaSemanaAds(servicios: ServicioActivo[]): { asignaciones: AsignacionDiaSemana[] } {
  const ocupacion = new Map<number, number>();
  for (let dia = PRIMER_DIA_SEMANA_ADS; dia <= ULTIMO_DIA_SEMANA_ADS; dia++) ocupacion.set(dia, 0);

  const asignaciones: AsignacionDiaSemana[] = [];

  // 1) Los que ya tienen día quedan fijos — nunca se tocan.
  for (const s of servicios) {
    if (s.diaSemanaAdsAsignado) {
      ocupacion.set(s.diaSemanaAdsAsignado, (ocupacion.get(s.diaSemanaAdsAsignado) ?? 0) + 1);
      asignaciones.push({ serviceId: s.id, diaSemana: s.diaSemanaAdsAsignado });
    }
  }

  // 2) Los nuevos se completan en el día con menos carga (empate → el día más bajo).
  for (const s of servicios) {
    if (s.diaSemanaAdsAsignado) continue;
    let elegido = PRIMER_DIA_SEMANA_ADS;
    let menorCarga = ocupacion.get(PRIMER_DIA_SEMANA_ADS) ?? 0;
    for (let dia = PRIMER_DIA_SEMANA_ADS + 1; dia <= ULTIMO_DIA_SEMANA_ADS; dia++) {
      const carga = ocupacion.get(dia) ?? 0;
      if (carga < menorCarga) {
        elegido = dia;
        menorCarga = carga;
      }
    }
    ocupacion.set(elegido, menorCarga + 1);
    asignaciones.push({ serviceId: s.id, diaSemana: elegido });
  }

  return { asignaciones };
}

/**
 * A partir de servicios ya con `diaSemanaAdsAsignado` resuelto, genera una
 * optimización por cada semana del mes en la fecha real de ese día,
 * reprogramando al día hábil siguiente si cae en feriado. Sin hora fija
 * (`horaProgramada` queda undefined) — el equipo organiza cuándo revisarlo
 * dentro del día.
 */
export function generarOptimizacionesAdsDelMes(
  servicios: ServicioActivo[],
  holidays: Holiday[],
  year: number,
  month: number,
): { optimizaciones: OptimizacionGenerada[]; advertencias: [] } {
  const optimizaciones: OptimizacionGenerada[] = [];

  const conDia = servicios.filter(
    (s): s is ServicioActivo & { diaSemanaAdsAsignado: number } => !!s.diaSemanaAdsAsignado,
  );

  for (const servicio of conDia) {
    const fechas = weekdayDatesOfMonth(year, month, servicio.diaSemanaAdsAsignado);
    for (const fecha of fechas) {
      const feriado = esFeriado(fecha, holidays);
      const fechaFinal = feriado ? diaHabilSiguiente(fecha, holidays) : fecha;
      optimizaciones.push({
        clientId: servicio.clientId,
        serviceId: servicio.id,
        tipo: servicio.tipo,
        fechaProgramada: fechaFinal,
        responsableId: servicio.responsableId,
        ...(feriado ? { reprogramada: { fechaOriginal: fecha, motivo: "feriado" as const } } : {}),
      });
    }
  }

  return { optimizaciones, advertencias: [] };
}
