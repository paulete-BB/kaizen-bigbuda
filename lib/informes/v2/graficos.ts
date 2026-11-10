/**
 * Gráficos del informe v2 como SVG/HTML en texto (el deck se arma como HTML
 * crudo, ver lib/informes/render.ts). Mismos datos que los gráficos de la
 * pestaña Resultados; estilo del PDF de referencia: línea oscura sobre área
 * arena, marcadores redondos y el último valor destacado.
 */
import { esc } from "@/lib/informes/render";
import { parseIso } from "@/lib/dates";

export const COLOR = {
  tinta: "#1f1d19",
  suave: "#6f6a5e",
  dorado: "#8a6a1a",
  doradoClaro: "#f1c79a",
  linea: "#e7e3d9",
  arena: "#d0c8b8",
  arenaBorde: "#8a7a60",
  area: "#e6e2d8",
  bueno: "#2f6b45",
  buenoFondo: "#e3efe5",
  malo: "#a8392f",
  maloFondo: "#f6e3df",
  neutroFondo: "#eeeae0",
};

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

export function fmtNum(n: number, decimales = 0): string {
  return n.toLocaleString("es-CL", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Techo "redondo" para el eje Y (1, 2, 2.5, 5 × 10^n). */
function techo(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return paso * exp;
}

export interface SerieLinea {
  nombre: string;
  color: string;
  valores: number[];
  punteada?: boolean;
  /** Rellena el área bajo la línea (solo para la serie principal). */
  area?: boolean;
}

export interface OpcionesLinea {
  ancho: number;
  alto: number;
  /** Una etiqueta (fecha ISO o texto) por punto; se muestran la primera, la del medio y la última. */
  etiquetas: string[];
  series: SerieLinea[];
  /** Formato del valor final destacado; por defecto entero con separador de miles. */
  formato?: (n: number) => string;
  /** "iso" convierte las etiquetas a "3 oct"; "texto" las deja tal cual. */
  tipoEtiqueta?: "iso" | "texto";
}

export function svgLineas(o: OpcionesLinea): string {
  const { ancho, alto, series, etiquetas } = o;
  const formato = o.formato ?? ((n: number) => fmtNum(n));
  const n = Math.max(...series.map((s) => s.valores.length), 0);
  if (n === 0) return `<div style="font-size:22px;color:${COLOR.suave};">Sin datos en el período.</div>`;

  const izq = 64;
  const der = 96;
  const arriba = 44;
  const abajo = 40;
  const w = ancho - izq - der;
  const h = alto - arriba - abajo;
  const max = techo(Math.max(...series.flatMap((s) => s.valores), 0));
  const x = (i: number) => izq + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => arriba + h - (v / max) * h;

  const grilla = [0, max / 2, max]
    .map((v) => `<line x1="${izq}" x2="${izq + w}" y1="${y(v)}" y2="${y(v)}" stroke="${COLOR.linea}" stroke-width="1.5"/><text x="${izq - 12}" y="${y(v) + 6}" text-anchor="end" font-size="18" fill="${COLOR.suave}">${esc(fmtNum(v, max < 10 && v % 1 !== 0 ? 1 : 0))}</text>`)
    .join("");

  const partes: string[] = [];
  series.forEach((s, idx) => {
    if (s.valores.length === 0) return;
    const puntos = s.valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    if (s.area && idx === 0) {
      partes.push(`<polygon points="${x(0).toFixed(1)},${y(0)} ${puntos.join(" ")} ${x(s.valores.length - 1).toFixed(1)},${y(0)}" fill="${COLOR.area}" opacity="0.9"/>`);
    }
    partes.push(`<polyline points="${puntos.join(" ")}" fill="none" stroke="${s.color}" stroke-width="${idx === 0 ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"${s.punteada ? ' stroke-dasharray="3 9"' : ""}/>`);
    // Marcadores: todos los puntos si son pocos, si no solo los extremos.
    s.valores.forEach((v, i) => {
      const extremo = i === 0 || i === s.valores.length - 1;
      if (s.valores.length <= 14 || extremo) {
        const ultimo = i === s.valores.length - 1;
        partes.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${ultimo ? 8 : 5}" fill="${ultimo ? s.color : "#fff"}" stroke="${s.color}" stroke-width="3"/>`);
      }
    });
    const ult = s.valores[s.valores.length - 1];
    partes.push(`<text x="${(x(s.valores.length - 1) + 14).toFixed(1)}" y="${(y(ult) + 7).toFixed(1)}" font-size="${idx === 0 ? 26 : 22}" font-weight="800" fill="${s.color}">${esc(formato(ult))}</text>`);
  });

  const lab = (i: number) => (o.tipoEtiqueta === "texto" ? (etiquetas[i] ?? "") : etiquetas[i] ? fechaCorta(etiquetas[i]) : "");
  const idxs = n <= 8 ? Array.from({ length: n }, (_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const ejeX = [...new Set(idxs)]
    .map((i) => `<text x="${x(i).toFixed(1)}" y="${alto - 8}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}" font-size="18" fill="${COLOR.suave}">${esc(lab(i))}</text>`)
    .join("");

  return `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:inherit;">${grilla}${partes.join("")}${ejeX}</svg>`;
}

/** Leyenda con muestra de línea (no cuadrados), una entrada por serie. */
export function leyendaLineas(series: Pick<SerieLinea, "nombre" | "color" | "punteada">[]): string {
  return `<div style="display:flex;gap:28px;flex-wrap:wrap;font-size:19px;color:${COLOR.suave};">${series
    .map(
      (s) =>
        `<span style="display:inline-flex;align-items:center;gap:10px;"><span style="display:inline-block;width:34px;height:0;border-top:4px ${s.punteada ? "dotted" : "solid"} ${s.color};"></span>${esc(s.nombre)}</span>`,
    )
    .join("")}</div>`;
}

/** Barra horizontal simple (distribución de posiciones). */
export function barraHorizontal(etiqueta: string, valor: number, max: number, color: string, texto: string): string {
  const pct = max > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / max) * 100) : 0;
  return `<div style="display:grid;grid-template-columns:200px 1fr 100px;align-items:center;gap:18px;margin:14px 0;"><span style="font-size:22px;font-weight:600;color:${COLOR.tinta};">${esc(etiqueta)}</span><span style="display:block;height:34px;background:${COLOR.neutroFondo};border-radius:8px;overflow:hidden;"><span style="display:block;height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:8px;"></span></span><span style="font-size:24px;font-weight:800;text-align:right;color:${COLOR.tinta};">${esc(texto)}</span></div>`;
}
