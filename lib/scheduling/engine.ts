import { generarOptimizacionesAdsDelMes } from "./ads";
import { detectarConflictoAusencia } from "./ausencias";
import { asignarViernesOrdinal, generarOptimizacionesSeoDelMes } from "./seo";
import type { Advertencia, AsignacionOrdinal, Absence, Holiday, OptimizacionGenerada, ServicioActivo } from "./types";

export interface ConstruirCalendarioMesInput {
  serviciosSeo: ServicioActivo[];
  serviciosAds: ServicioActivo[];
  holidays: Holiday[];
  absences: Absence[];
  year: number;
  month: number;
  direccionFeriadoSeo?: "anterior" | "siguiente";
}

export interface ConstruirCalendarioMesOutput {
  optimizaciones: OptimizacionGenerada[];
  asignacionesOrdinal: AsignacionOrdinal[];
  advertencias: Advertencia[];
}

/**
 * Orquesta las reglas A + B + D para un mes: resuelve los viernes ordinales
 * pendientes, genera las optimizaciones SEO (viernes) y Ads (miércoles
 * 16:00) reprogramando por feriado, y marca conflictos de ausencia del
 * responsable (sin reasignar solo).
 */
export function construirCalendarioMes(input: ConstruirCalendarioMesInput): ConstruirCalendarioMesOutput {
  const { asignaciones, advertencias: advertenciasOrdinal } = asignarViernesOrdinal(input.serviciosSeo);
  const ordinalPorServicio = new Map(asignaciones.map((a) => [a.serviceId, a.ordinal]));
  const serviciosSeoResueltos = input.serviciosSeo.map((s) => ({
    ...s,
    viernesOrdinalAsignado: ordinalPorServicio.get(s.id) ?? null,
  }));

  const { optimizaciones: seo, advertencias: advertenciasSeo } = generarOptimizacionesSeoDelMes(
    serviciosSeoResueltos,
    input.holidays,
    input.year,
    input.month,
    { direccionFeriado: input.direccionFeriadoSeo },
  );

  const { optimizaciones: ads } = generarOptimizacionesAdsDelMes(
    input.serviciosAds,
    input.holidays,
    input.year,
    input.month,
  );

  const todas = [...seo, ...ads].map((o) => ({
    ...o,
    conflictoAusencia: detectarConflictoAusencia(o.fechaProgramada, o.responsableId, input.absences),
  }));

  const advertenciasAusencia: Advertencia[] = todas
    .filter((o) => o.conflictoAusencia)
    .map((o) => ({
      tipo: "conflicto_ausencia",
      mensaje: `El responsable asignado está ausente el ${o.fechaProgramada}.`,
      serviceId: o.serviceId,
      clientId: o.clientId,
    }));

  return {
    optimizaciones: todas,
    asignacionesOrdinal: asignaciones,
    advertencias: [...advertenciasOrdinal, ...advertenciasSeo, ...advertenciasAusencia],
  };
}
