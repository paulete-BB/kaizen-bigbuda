import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { KpiCards } from "./KpiCards";
import { HoySemanaPanel } from "./HoySemanaPanel";
import { AlertasPanel } from "./AlertasPanel";
import { MiDiaView } from "./MiDiaView";
import { CarteraTabla } from "./CarteraTabla";
import type { DashboardData } from "@/lib/data/dashboard";
import type { FilaAds, MiDiaData } from "@/lib/data/mi-dia";
import { fmtFechaLarga, hoySantiago } from "@/lib/dates";

export type VistaDashboard = "mi-dia" | "cartera";

export function DashboardView({
  vista,
  miDia,
  cartera,
  data,
  usuario,
}: {
  vista: VistaDashboard;
  miDia?: MiDiaData;
  cartera?: FilaAds[];
  data?: DashboardData;
  usuario: SidebarUsuario;
}) {
  const primerNombre = usuario.nombre.split(" ")[0];
  const tab = (activa: boolean) => ({
    background: activa ? "var(--color-accent-soft)" : "var(--color-surface)",
    color: activa ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
  });

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
          <div className="flex w-fit overflow-hidden rounded-[9px] border border-border">
            <Link href="/dashboard" className="px-4 py-2 text-[12.5px] font-semibold" style={tab(vista === "mi-dia")}>Mi día</Link>
            <Link href="/dashboard?vista=cartera" className="border-l border-border px-4 py-2 text-[12.5px] font-semibold" style={tab(vista === "cartera")}>Cartera</Link>
          </div>

          {vista === "mi-dia" && miDia && <MiDiaView data={miDia} />}

          {vista === "cartera" && cartera && data && (
            <>
              <CarteraTabla filas={cartera} />
              <KpiCards data={data} />
              <div className="col2 grid items-start gap-5" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
                <HoySemanaPanel hoy={data.eventosHoy} semana={data.eventosSemana} />
                <AlertasPanel data={data} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
