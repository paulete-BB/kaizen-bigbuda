/**
 * Cambio de responsables que hay que pedirle a ClickUp para que una tarea
 * existente quede asignada solo al responsable deseado. El PUT de una tarea
 * no acepta un arreglo de ids como el POST de creación: espera
 * `{ add: [...], rem: [...] }`, así que hay que comparar contra lo que ya
 * tiene la tarea.
 */
export function calcularCambioAsignados(actuales: number[], deseado: number): { add: number[]; rem: number[] } {
  return {
    add: actuales.includes(deseado) ? [] : [deseado],
    rem: actuales.filter((id) => id !== deseado),
  };
}
