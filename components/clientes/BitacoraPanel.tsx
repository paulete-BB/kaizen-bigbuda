import Link from "next/link";
import type { BitacoraEntrada } from "@/lib/data/bitacora";
import { fmtFecha } from "@/lib/dates";

const SYNC_LABEL: Record<BitacoraEntrada["syncStatus"], { label: string; color: string }> = {
  ok: { label: "Sincronizado", color: "var(--color-success)" },
  pendiente_sync: { label: "Pendiente de sync", color: "var(--color-warning)" },
  error: { label: "Error de sync", color: "var(--color-danger)" },
};

export function BitacoraPanel({ entradas, clienteId }: { entradas: BitacoraEntrada[]; clienteId: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
        <span className="text-[14.5px] font-bold">Bitácora</span>
        <span className="text-[12px] font-medium text-muted-2">Últimas optimizaciones e informes</span>
      </div>

      <div className="px-5 pb-3 pt-1.5">
        {entradas.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-muted-2">Todavía no hay entradas en la bitácora.</p>
        )}
        {entradas.map((e, i) => {
          const sync = SYNC_LABEL[e.syncStatus];
          const isLast = i === entradas.length - 1;
          const fecha = e.cuando.slice(0, 10);
          return (
            <div key={e.id} className={`tl-item flex gap-3.5 py-3.5 ${isLast ? "" : "border-b border-border-soft-2"}`}>
              <div className="flex flex-none flex-col items-center">
                <span className="mt-1 h-[11px] w-[11px] rounded-full bg-accent" />
                {!isLast && <span className="mt-1 w-0.5 flex-1 bg-border-soft" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{e.titulo}</span>
                  <span className="text-[11px] text-muted">{fmtFecha(fecha)}</span>
                  <span className="rounded-full bg-accent-soft px-[7px] py-px text-[10.5px] font-semibold text-accent-soft-ink">
                    {e.tipo}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted-2">{e.desc}</div>
                <div className="mt-[7px] flex items-center gap-3">
                  {e.responsable && (
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-2">{e.responsable}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: sync.color }}>
                    {sync.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border-soft bg-hover-2 px-5 py-3">
        <Link
          href={`/clientes/${clienteId}/bitacora`}
          className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold"
        >
          Ver bitácora completa
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
