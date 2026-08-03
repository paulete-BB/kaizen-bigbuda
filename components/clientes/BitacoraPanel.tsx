import Link from "next/link";
import type { CambioBitacora } from "@/lib/clientes/types";
import { BITACORA_SEED, PERSONAS } from "@/lib/clientes/mock";

const SYNC_LABEL: Record<"ok" | "pendiente" | "error", { label: string; color: string }> = {
  ok: { label: "Sincronizado", color: "var(--color-success)" },
  pendiente: { label: "Pendiente de sync", color: "var(--color-warning)" },
  error: { label: "Error de sync", color: "var(--color-danger)" },
};

export function BitacoraPanel({ cambios, clienteId }: { cambios: CambioBitacora[]; clienteId: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
        <span className="text-[14.5px] font-bold">Bitácora</span>
        <span className="text-[12px] font-medium text-muted-2">Últimas optimizaciones e informes</span>
      </div>

      <div className="px-5 pb-3 pt-1.5">
        {cambios.map((c) => (
          <div key={c.id} className="tl-item flex gap-3.5 border-b border-border-soft-2 py-3.5">
            <div className="flex flex-none flex-col items-center">
              <span className="mt-1 h-[11px] w-[11px] rounded-full bg-accent" />
              <span className="mt-1 w-0.5 flex-1 bg-border-soft" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold">{c.titulo}</span>
                <span className="text-[11px] text-muted">{c.cuando}</span>
                <span className="rounded-full bg-accent-soft px-[7px] py-px text-[10.5px] font-semibold text-accent-soft-ink">
                  {c.tipo}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-muted-2">{c.desc}</div>
              <div className="mt-[7px] flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-2">
                  <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                    MA
                  </span>
                  Marcel
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                  Pendiente de sync
                </span>
              </div>
            </div>
          </div>
        ))}

        {BITACORA_SEED.map((c, i) => {
          const persona = PERSONAS[c.quien];
          const sync = SYNC_LABEL[c.syncEstado];
          const isLast = i === BITACORA_SEED.length - 1;
          return (
            <div key={c.id} className={`tl-item flex gap-3.5 py-3.5 ${isLast ? "" : "border-b border-border-soft-2"}`}>
              <div className="flex flex-none flex-col items-center">
                <span className="mt-1 h-[11px] w-[11px] rounded-full" style={{ background: c.color }} />
                {!isLast && <span className="mt-1 w-0.5 flex-1 bg-border-soft" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{c.titulo}</span>
                  <span className="text-[11px] text-muted">{c.cuando}</span>
                  {c.tipoBadge && (
                    <span className="rounded-full bg-success-bg px-[7px] py-px text-[10.5px] font-semibold text-success">
                      {c.tipoBadge}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-2">{c.desc}</div>
                <div className="mt-[7px] flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-2">
                    <span
                      className="flex h-[17px] w-[17px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ background: persona.color }}
                    >
                      {c.quien}
                    </span>
                    {persona.nombre}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: sync.color }}>
                    {sync.label}
                  </span>
                  {c.syncEstado === "error" && (
                    <a href="#" className="text-[11px] font-semibold">
                      Reintentar
                    </a>
                  )}
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
