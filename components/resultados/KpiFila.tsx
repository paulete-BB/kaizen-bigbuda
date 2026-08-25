import type { KpiResultado } from "@/lib/data/resultados";
import { fmtDeltaPct } from "@/lib/resultados-formato";

function FlechaDelta({ tendencia }: { tendencia: "up" | "down" | "flat" }) {
  if (tendencia === "flat") return <span>·</span>;
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: tendencia === "down" ? "rotate(180deg)" : undefined }}>
      <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiFila({ kpis }: { kpis: KpiResultado[] }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
      {kpis.map((k) => (
        <div key={k.etiqueta} className="rounded-[12px] border border-border bg-surface p-3.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">{k.etiqueta}</div>
          <div className="mt-1.5 text-[19px] font-bold leading-none text-ink">{k.valor}</div>
          {k.delta && (
            <div
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: k.delta.tendencia === "flat" ? "var(--color-muted-2)" : k.delta.favorable ? "var(--color-success)" : "var(--color-danger)" }}
            >
              <FlechaDelta tendencia={k.delta.tendencia} />
              {k.delta.pct === null ? "nuevo" : fmtDeltaPct(k.delta.pct)}
              <span className="font-normal text-muted-2">vs. período anterior</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
