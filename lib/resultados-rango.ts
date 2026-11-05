import { addDaysIso } from "@/lib/dates";

/** Sin dependencias de servidor (sin `lib/db`) — se importa tanto desde la capa de datos como desde componentes cliente (selector de rango). */
export const RANGOS_RESULTADOS = [7, 14, 28, 90, "mes"] as const;
export type RangoResultados = (typeof RANGOS_RESULTADOS)[number];

export const RANGO_POR_DEFECTO: RangoResultados = 28;

export interface RangoFechas {
  desde: string;
  hasta: string;
}

/** Interpreta el parámetro `rango` de la URL ("7", "14", "28", "90" o "mes"); cualquier otro valor cae al rango por defecto. */
export function parsearRango(raw: string | undefined): RangoResultados {
  if (raw === "mes") return "mes";
  const n = Number(raw);
  const encontrado = RANGOS_RESULTADOS.find((r) => r === n);
  return encontrado ?? RANGO_POR_DEFECTO;
}

export function etiquetaRango(rango: RangoResultados): string {
  return rango === "mes" ? "Este mes" : `${rango}d`;
}

/**
 * Rango actual y rango anterior con el que se compara. Para los rangos en días, el anterior es la ventana
 * inmediatamente previa del mismo largo. Para "Este mes" (del día 1 a hoy), se compara contra los mismos
 * días del mes anterior (ej. 1-5 nov vs. 1-5 oct): comparar 5 días contra un mes entero no diría nada.
 */
export function calcularRangosResultados(rango: RangoResultados, hoy: string): { actual: RangoFechas; anterior: RangoFechas } {
  if (rango === "mes") {
    const desde = `${hoy.slice(0, 7)}-01`;
    const dias = Number(hoy.slice(8, 10));
    const ultimoDiaMesAnterior = addDaysIso(desde, -1);
    const primerDiaMesAnterior = `${ultimoDiaMesAnterior.slice(0, 7)}-01`;
    const mismoLargo = addDaysIso(primerDiaMesAnterior, dias - 1);
    const hastaAnterior = mismoLargo < ultimoDiaMesAnterior ? mismoLargo : ultimoDiaMesAnterior;
    return { actual: { desde, hasta: hoy }, anterior: { desde: primerDiaMesAnterior, hasta: hastaAnterior } };
  }
  const desde = addDaysIso(hoy, -(rango - 1));
  const hastaAnterior = addDaysIso(desde, -1);
  const desdeAnterior = addDaysIso(hastaAnterior, -(rango - 1));
  return { actual: { desde, hasta: hoy }, anterior: { desde: desdeAnterior, hasta: hastaAnterior } };
}
