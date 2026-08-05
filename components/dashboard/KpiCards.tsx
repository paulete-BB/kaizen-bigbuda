import { Donut } from "./Donut";
import type { DashboardData } from "@/lib/data/dashboard";

export function KpiCards({ data }: { data: DashboardData }) {
  const { cumplimiento, vigencias } = data;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex items-center gap-4 rounded-[14px] border border-border bg-surface p-5">
        <Donut
          centerLabel={`${cumplimiento.pct}%`}
          segments={[
            { pct: cumplimiento.pct, color: "var(--color-success)" },
            { pct: 100 - cumplimiento.pct, color: "var(--color-danger)" },
          ]}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-bold">Cumplimiento del calendario</span>
            <span
              className="text-[11.5px] font-bold"
              style={{ color: cumplimiento.variacionPts >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {cumplimiento.variacionPts >= 0 ? "+" : ""}
              {cumplimiento.variacionPts}pts
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-[12px] text-muted">
            <span>
              <b className="font-semibold text-ink">{cumplimiento.aTiempo}</b> a tiempo
            </span>
            <span>
              <b className="font-semibold text-ink">{cumplimiento.atrasadas}</b> atrasadas
            </span>
            <span className="text-muted-2">de {cumplimiento.total} tareas programadas del mes hasta hoy</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-[14px] border border-border bg-surface p-5">
        <Donut
          centerLabel={String(vigencias.porAtender)}
          segments={[
            { pct: vigencias.total ? (vigencias.vigentes / vigencias.total) * 100 : 0, color: "var(--color-success)" },
            { pct: vigencias.total ? (vigencias.porVencer / vigencias.total) * 100 : 0, color: "var(--color-warning)" },
            { pct: vigencias.total ? (vigencias.vencidos / vigencias.total) * 100 : 0, color: "var(--color-danger)" },
          ]}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold">Vigencias y descuentos</div>
          <div className="mt-2 flex flex-col gap-1 text-[12px] text-muted">
            <span>
              <b className="font-semibold text-ink">{vigencias.vigentes}</b> vigentes
            </span>
            <span>
              <b className="font-semibold text-ink">{vigencias.porVencer}</b> por vencer (≤20 días)
            </span>
            <span>
              <b className="font-semibold text-ink">{vigencias.vencidos}</b> vencidos
            </span>
            <span className="text-muted-2">de {vigencias.total} servicios y descuentos activos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
