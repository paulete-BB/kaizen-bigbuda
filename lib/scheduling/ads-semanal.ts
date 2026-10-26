import { addDaysIso, weekdayOfIso } from "./dates";

export const SEMANAS_ADELANTE_ADS = 4;

/**
 * Fechas en que le toca la optimización semanal a un servicio de Ads con día
 * de la semana asignado (1 = lunes … 5 = viernes), desde `hoy` (inclusive)
 * hasta `semanas` semanas hacia adelante. Solo fechas, sin feriados ni
 * duplicados — eso lo resuelve quien las inserta.
 */
export function fechasSemanalesAds(hoy: string, diaSemana: number, semanas = SEMANAS_ADELANTE_ADS): string[] {
  if (diaSemana < 1 || diaSemana > 5) return [];
  const lunes = addDaysIso(hoy, -((weekdayOfIso(hoy) + 6) % 7));
  const limite = addDaysIso(hoy, semanas * 7);
  const fechas: string[] = [];
  for (let k = 0; k <= semanas; k++) {
    const fecha = addDaysIso(lunes, diaSemana - 1 + 7 * k);
    if (fecha >= hoy && fecha <= limite) fechas.push(fecha);
  }
  return fechas;
}

/** Lunes y domingo de la semana que contiene `iso`. */
export function limitesSemana(iso: string): { lunes: string; domingo: string } {
  const lunes = addDaysIso(iso, -((weekdayOfIso(iso) + 6) % 7));
  return { lunes, domingo: addDaysIso(lunes, 6) };
}
