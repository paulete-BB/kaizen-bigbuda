/** Fechas de calendario (America/Santiago), compartidas por toda la app. */

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function hoySantiago(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtFecha(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtFechaLarga(d: Date): string {
  const s = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function diasHasta(iso: string, hoy: Date): number {
  return Math.round((parseIso(iso).getTime() - hoy.getTime()) / 86_400_000);
}

export function addMeses(iso: string, n: number): string {
  const d = parseIso(iso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return toIso(d);
}

export function addDaysIso(iso: string, delta: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

/** Grilla mensual completa (lunes a domingo), incluyendo días de meses adyacentes. */
export function buildMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const start = new Date(year, month - 1, 1 - firstWeekday);
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIso(d);
  });
}

