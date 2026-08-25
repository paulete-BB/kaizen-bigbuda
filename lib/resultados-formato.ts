/** Formateadores compartidos entre el server component (KPIs) y los charts cliente — sin `lib/db`, para que puedan cruzar el límite server/client como prop (una función no puede cruzarlo, un string sí). */
export type FormatoValor = "numero" | "moneda";

export function formatearValor(n: number, formato: FormatoValor = "numero"): string {
  if (formato === "moneda") return `$${Math.round(n).toLocaleString("es-CL")}`;
  return Math.round(n).toLocaleString("es-CL");
}

/**
 * Con un período anterior casi en cero, el % de cambio explota a números
 * como "+3655,9%" — matemáticamente correcto pero ilegible en un dashboard
 * que se muestra en vivo al cliente. Se acota a ±999% (convención común en
 * paneles de ads), mismo criterio que el resto: el signo es literal, no se
 * infla el drama de un denominador chico.
 */
export function fmtDeltaPct(pct: number): string {
  const capped = Math.sign(pct) * Math.min(Math.abs(pct), 999);
  const sufijo = Math.abs(pct) > 999 ? "+" : "";
  return `${capped > 0 ? "+" : ""}${capped}${sufijo}%`;
}
