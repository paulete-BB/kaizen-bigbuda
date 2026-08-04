import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { KpiCards } from "./KpiCards";
import { HoySemanaPanel } from "./HoySemanaPanel";
import { AlertasPanel } from "./AlertasPanel";
import type { DashboardData } from "@/lib/data/dashboard";
import { fmtFechaLarga, hoySantiago } from "@/lib/dates";

export function DashboardView({ data, usuario }: { data: DashboardData; usuario: SidebarUsuario }) {
  const primerNombre = usuario.nombre.split(" ")[0];

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="dashboard" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-[26px]">
          <div>
            <div className="text-[14px] font-bold">Buenos días, {primerNombre}</div>
            <div className="text-[11.5px] text-muted-2">{fmtFechaLarga(hoySantiago())} · Santiago</div>
          </div>
        </header>

        <div className="flex w-full max-w-[1360px] flex-col gap-5 px-[26px] pb-10 pt-[22px]">
          <KpiCards data={data} />

          <div className="col2 grid items-start gap-5" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
            <HoySemanaPanel hoy={data.eventosHoy} semana={data.eventosSemana} />
            <AlertasPanel data={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
