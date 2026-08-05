import type { Absence } from "./types";

/**
 * Regla D (ausencias) — solo detecta el conflicto; la reasignación de
 * responsable es una acción del usuario en el dashboard ("un clic"), el
 * motor no decide un reemplazo por sí solo.
 */
export function detectarConflictoAusencia(
  fechaProgramada: string,
  responsableId: string | null | undefined,
  absences: Absence[],
): boolean {
  if (!responsableId) return false;
  return absences.some(
    (a) =>
      a.userId === responsableId &&
      fechaProgramada >= a.fechaInicio &&
      fechaProgramada <= a.fechaFin,
  );
}
