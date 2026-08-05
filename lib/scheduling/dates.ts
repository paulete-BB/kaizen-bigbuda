/** Fechas en calendario local (America/Santiago), sin conversiones UTC. */

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function partsFromIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function toDate(iso: string): Date {
  const { year, month, day } = partsFromIso(iso);
  return new Date(year, month - 1, day);
}

/** 0 = domingo … 6 = sábado */
export function weekdayOfIso(iso: string): number {
  return toDate(iso).getDay();
}

export function addDaysIso(iso: string, delta: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + delta);
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function allWeekdayDatesOfMonth(year: number, month: number, weekday: number): string[] {
  const total = daysInMonth(year, month);
  const dates: string[] = [];
  for (let day = 1; day <= total; day++) {
    const iso = isoFromParts(year, month, day);
    if (weekdayOfIso(iso) === weekday) dates.push(iso);
  }
  return dates;
}

/** Todos los viernes del mes (año, mes 1-12), en orden ascendente. */
export function fridaysOfMonth(year: number, month: number): string[] {
  return allWeekdayDatesOfMonth(year, month, 5);
}

/** Todos los miércoles del mes (año, mes 1-12), en orden ascendente. */
export function wednesdaysOfMonth(year: number, month: number): string[] {
  return allWeekdayDatesOfMonth(year, month, 3);
}
