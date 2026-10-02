/**
 * Catálogo de métricas conocidas para "¿Cómo vamos?" del informe de Ads —
 * cada una lleva asociado de antemano si subir es buena o mala noticia (o
 * ninguna de las dos), para que el color del delta se asigne solo, sin que
 * quien cargue el informe tenga que adivinarlo cada vez. Sin este catálogo,
 * cada fila necesitaba que alguien eligiera "¿es buena noticia?" a mano —
 * lo que de hecho pasó: un informe real terminó con "Costo" (gasto total,
 * subir no es ni bueno ni malo) tratado igual que "Costo por resultado"
 * (subir si es malo), y con filas manuales sin el campo en absoluto, lo que
 * las dejaba todas en rojo por defecto.
 *
 * Exactamente las mismas 9 métricas que usa `seccionMeta`/`seccionGoogleAds`
 * en `lib/data/resultados.ts` (pestaña Resultados) — pedido explícito del
 * usuario: el informe debe mostrar "las mismas métricas" que Resultados, no
 * un superset. "CPC" (Meta) y "Costo" total (Google Ads) existían acá pero
 * nunca se muestran en Resultados — se sacaron del catálogo junto con el
 * pre-llenado automático correspondiente.
 */

export type CriterioMetrica = "sube_bueno" | "sube_malo" | "neutro";
export type Favorable = "bueno" | "malo" | "neutro";

export const CRITERIO_METRICA: Record<string, CriterioMetrica> = {
  Inversión: "neutro",
  Resultados: "sube_bueno",
  "Costo por resultado": "sube_malo",
  CTR: "sube_bueno",
  Alcance: "sube_bueno",
  "Sesiones pagas": "sube_bueno",
  Conversiones: "sube_bueno",
  "Tasa de conversión": "sube_bueno",
  "Costo por conversión": "sube_malo",
};

/** Lista para el `<select>` del editor — mismo orden que `CRITERIO_METRICA`. */
export const CATALOGO_METRICAS_SUGERIDAS = Object.keys(CRITERIO_METRICA);

/** Métrica desconocida (no está en el catálogo) → sin suposición, queda neutra hasta que alguien la clasifique a mano. */
export function criterioDeMetrica(etiqueta: string): CriterioMetrica {
  return CRITERIO_METRICA[etiqueta] ?? "neutro";
}

export function criterioAFavorable(criterio: CriterioMetrica, direccion: "up" | "down"): Favorable {
  if (criterio === "neutro") return "neutro";
  if (criterio === "sube_bueno") return direccion === "up" ? "bueno" : "malo";
  return direccion === "up" ? "malo" : "bueno";
}

/**
 * Recalcula `favorable` para las filas cuya etiqueta coincide con el
 * catálogo — usado al abrir el editor para corregir en el momento informes
 * ya guardados con el campo viejo (booleano, o ausente): sin esto, un
 * informe creado antes de que `favorable` existiera como catálogo se queda
 * con el valor guardado (incorrecto) hasta que alguien edite cada fila a
 * mano. Las filas con etiqueta personalizada (no están en el catálogo)
 * quedan intactas — ahí no hay nada que inferir.
 */
export function recalcularFavorablesConocidas<T extends { etiqueta: string; deltaDireccion: "up" | "down"; favorable: Favorable }>(metricas: T[]): T[] {
  return metricas.map((m) =>
    m.etiqueta in CRITERIO_METRICA ? { ...m, favorable: criterioAFavorable(criterioDeMetrica(m.etiqueta), m.deltaDireccion) } : m,
  );
}
