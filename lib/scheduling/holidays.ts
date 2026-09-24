import { addDaysIso, weekdayOfIso } from "./dates";
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

function esFinDeSemana(iso: string): boolean {
  const dia = weekdayOfIso(iso);
  return dia === 0 || dia === 6;
}

/**
 * Día hábil siguiente (regla D, Ads): avanza de a un día, saltando fines de
 * semana y feriados — reemplaza a `juevesSiguiente` (que asumía que Ads
 * siempre caía en miércoles y avanzaba un día fijo sin revisar si el
 * destino también era feriado). Aplica al día de semana que le toque a
 * cada servicio de Ads (Regla B ya no es exclusiva de miércoles).
 */
export function diaHabilSiguiente(iso: string, holidays: Holiday[]): string {
  let candidato = iso;
  for (let i = 0; i < MAX_PASOS_BUSQUEDA; i++) {
    candidato = addDaysIso(candidato, 1);
    if (!esFinDeSemana(candidato) && !esFeriado(candidato, holidays)) return candidato;
  }
  return candidato;
}
