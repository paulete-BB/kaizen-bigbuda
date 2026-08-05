import { addDaysIso } from "./dates";
import type { Holiday } from "./types";

export function esFeriado(iso: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.fecha === iso);
}

const MAX_PASOS_BUSQUEDA = 8; // tope de seguridad (8 semanas) para no ciclar infinito

/** Viernes anterior que no sea feriado (regla D, dirección default para SEO). */
export function viernesAnteriorHabil(iso: string, holidays: Holiday[]): string {
  let candidato = iso;
  for (let i = 0; i < MAX_PASOS_BUSQUEDA; i++) {
    candidato = addDaysIso(candidato, -7);
    if (!esFeriado(candidato, holidays)) return candidato;
  }
  return candidato;
}

/** Viernes siguiente que no sea feriado (regla D, dirección configurable). */
export function viernesSiguienteHabil(iso: string, holidays: Holiday[]): string {
  let candidato = iso;
  for (let i = 0; i < MAX_PASOS_BUSQUEDA; i++) {
    candidato = addDaysIso(candidato, 7);
    if (!esFeriado(candidato, holidays)) return candidato;
  }
  return candidato;
}

/** Miércoles feriado → jueves de la misma semana a las 16:00 (regla D, fija). */
export function juevesSiguiente(iso: string): string {
  return addDaysIso(iso, 1);
}
