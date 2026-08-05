import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { MonthGrid } from "./MonthGrid";
import type { EventoCalendario, HolidayMes } from "@/lib/data/calendario";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function hrefMes(year: number, month: number) {
  return `/calendario?year=${year}&month=${month}`;
}

export function CalendarioView({
  usuario,
  year,
  month,
  eventos,
  holidays,
}: {
  usuario: SidebarUsuario;
  year: number;
  month: number;
  eventos: EventoCalendario[];
  holidays: HolidayMes[];
}) {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="calendario" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-[26px]">
          <div>
            <div className="text-[14px] font-bold">Calendario</div>
            <div className="text-[11.5px] text-muted-2">Planificación de optimizaciones · Santiago (America/Santiago)</div>
          </div>
        </header>

        <div className="flex w-full max-w-[1360px] flex-col gap-4 px-[26px] pb-10 pt-[22px]">
          <div className="flex items-center gap-3">
            <Link href={hrefMes(prevYear, prevMonth)} className="ghost rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-muted">
              ←
            </Link>
            <span className="text-[15px] font-bold">
              {MESES[month - 1]} {year}
            </span>
            <Link href={hrefMes(nextYear, nextMonth)} className="ghost rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-muted">
              →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#6d5bd6" }} />
              SEO · AEO · GEO — viernes, 2 slots/día
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#0d9488" }} />
              Ads (Meta + Google) — miércoles 16:00
            </span>
            <span className="text-muted-2">Arrastra un cliente SEO a otro viernes para reasignarlo de forma estable.</span>
          </div>

          <MonthGrid year={year} month={month} eventos={eventos} holidays={holidays} />
        </div>
      </main>
    </div>
  );
}
