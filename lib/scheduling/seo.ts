import { fridaysOfMonth } from "./dates";
import { esFeriado, viernesAnteriorHabil, viernesSiguienteHabil } from "./holidays";
import type { Advertencia, AsignacionOrdinal, Holiday, OptimizacionGenerada, ServicioActivo } from "./types";

export const MAX_SEO_POR_VIERNES = 2;
export const MAX_ORDINALES = 5; // no hay mes con más de 5 viernes

/**
 * Regla A — distribuye los servicios SEO·AEO·GEO activos en "su viernes del
 * mes" (1º..5º), máx. 2 por viernes, de forma ESTABLE: un servicio que ya
 * tiene ordinal asignado nunca se reasigna; solo se completan los que no
 * tienen. Si la cartera excede la capacidad (viernes disponibles × 2), el
 * excedente queda sin asignar y se reporta como advertencia.
 */
export function asignarViernesOrdinal(servicios: ServicioActivo[]): {
  asignaciones: AsignacionOrdinal[];
  advertencias: Advertencia[];
} {
  const ocupacion = new Map<number, number>();
  for (let ordinal = 1; ordinal <= MAX_ORDINALES; ordinal++) ocupacion.set(ordinal, 0);

  const asignaciones: AsignacionOrdinal[] = [];
  const advertencias: Advertencia[] = [];

  // 1) Los que ya tienen ordinal quedan fijos — nunca se tocan.
  for (const s of servicios) {
    if (s.viernesOrdinalAsignado) {
      ocupacion.set(s.viernesOrdinalAsignado, (ocupacion.get(s.viernesOrdinalAsignado) ?? 0) + 1);
      asignaciones.push({ serviceId: s.id, ordinal: s.viernesOrdinalAsignado });
    }
  }

  // 2) Los nuevos se completan en el primer viernes con cupo, en orden estable.
  for (const s of servicios) {
    if (s.viernesOrdinalAsignado) continue;
    let elegido: number | null = null;
    for (let ordinal = 1; ordinal <= MAX_ORDINALES; ordinal++) {
      if ((ocupacion.get(ordinal) ?? 0) < MAX_SEO_POR_VIERNES) {
        elegido = ordinal;
        break;
      }
    }
    if (elegido === null) {
      advertencias.push({
        tipo: "sobrecupo_viernes",
        mensaje: `La cartera activa de SEO·AEO·GEO excede la capacidad mensual (${MAX_ORDINALES} viernes × ${MAX_SEO_POR_VIERNES}). Redistribuir manualmente.`,
        serviceId: s.id,
        clientId: s.clientId,
      });
      continue;
    }
    ocupacion.set(elegido, (ocupacion.get(elegido) ?? 0) + 1);
    asignaciones.push({ serviceId: s.id, ordinal: elegido });
  }

  return { asignaciones, advertencias };
}

interface GenerarSeoOpciones {
  direccionFeriado?: "anterior" | "siguiente";
}

/**
 * A partir de servicios ya con `viernesOrdinalAsignado` resuelto, genera la
 * fecha real de ese mes para cada uno, reprogramando si cae en feriado
 * (viernes anterior por default) sin exceder el máximo de 2 por viernes en
 * el destino.
 */
export function generarOptimizacionesSeoDelMes(
  servicios: ServicioActivo[],
  holidays: Holiday[],
  year: number,
  month: number,
  opciones: GenerarSeoOpciones = {},
): { optimizaciones: OptimizacionGenerada[]; advertencias: Advertencia[] } {
  const direccion = opciones.direccionFeriado ?? "anterior";
  const fridays = fridaysOfMonth(year, month);
  const advertencias: Advertencia[] = [];
  const ocupacionPorFecha = new Map<string, number>();

  const conOrdinal = servicios.filter(
    (s): s is ServicioActivo & { viernesOrdinalAsignado: number } => !!s.viernesOrdinalAsignado,
  );

  const naive = conOrdinal.map((s) => {
    let fecha: string;
    if (s.viernesOrdinalAsignado <= fridays.length) {
      fecha = fridays[s.viernesOrdinalAsignado - 1];
    } else {
      advertencias.push({
        tipo: "mes_sin_viernes_suficientes",
        mensaje: `El mes ${year}-${month} solo tiene ${fridays.length} viernes; el servicio tenía asignado el ${s.viernesOrdinalAsignado}.º.`,
        serviceId: s.id,
        clientId: s.clientId,
      });
      fecha = fridays[fridays.length - 1];
    }
    return { servicio: s, fechaOriginal: fecha };
  });

  // Reservar cupo de los que NO caen en feriado primero (orden estable).
  for (const { fechaOriginal } of naive) {
    if (!esFeriado(fechaOriginal, holidays)) {
      ocupacionPorFecha.set(fechaOriginal, (ocupacionPorFecha.get(fechaOriginal) ?? 0) + 1);
    }
  }

  const optimizaciones: OptimizacionGenerada[] = naive.map(({ servicio, fechaOriginal }) => {
    if (!esFeriado(fechaOriginal, holidays)) {
      return {
        clientId: servicio.clientId,
        serviceId: servicio.id,
        tipo: "seo_aeo_geo",
        fechaProgramada: fechaOriginal,
        viernesOrdinal: servicio.viernesOrdinalAsignado,
        responsableId: servicio.responsableId,
      };
    }

    // Busca el próximo candidato (en la dirección configurada) con cupo.
    let candidato = fechaOriginal;
    const buscar = direccion === "anterior" ? viernesAnteriorHabil : viernesSiguienteHabil;
    for (let intentos = 0; intentos < 8; intentos++) {
      candidato = buscar(candidato, holidays);
      const ocupados = ocupacionPorFecha.get(candidato) ?? 0;
      if (ocupados < MAX_SEO_POR_VIERNES) {
        ocupacionPorFecha.set(candidato, ocupados + 1);
        break;
      }
    }

    return {
      clientId: servicio.clientId,
      serviceId: servicio.id,
      tipo: "seo_aeo_geo",
      fechaProgramada: candidato,
      viernesOrdinal: servicio.viernesOrdinalAsignado,
      responsableId: servicio.responsableId,
      reprogramada: { fechaOriginal, motivo: "feriado" },
    };
  });

  return { optimizaciones, advertencias };
}
