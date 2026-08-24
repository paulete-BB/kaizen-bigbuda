/** Formateadores compartidos entre el server component (KPIs) y los charts cliente — sin `lib/db`, para que puedan cruzar el límite server/client como prop (una función no puede cruzarlo, un string sí). */
export type FormatoValor = "numero" | "moneda";

export function formatearValor(n: number, formato: FormatoValor = "numero"): string {
  if (formato === "moneda") return `$${Math.round(n).toLocaleString("es-CL")}`;
  return Math.round(n).toLocaleString("es-CL");
}
