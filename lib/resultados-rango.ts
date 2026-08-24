/** Sin dependencias de servidor (sin `lib/db`) — se importa tanto desde la capa de datos como desde componentes cliente (selector de rango). */
export const RANGOS_RESULTADOS = [14, 28, 90] as const;
export type RangoResultados = (typeof RANGOS_RESULTADOS)[number];
