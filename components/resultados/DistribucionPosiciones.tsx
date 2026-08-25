import { Donut } from "@/components/dashboard/Donut";
import type { DistribucionPosiciones as DistribucionPosicionesData } from "@/lib/data/resultados";

const BUCKETS: { key: keyof Omit<DistribucionPosicionesData, "total">; etiqueta: string; color: string }[] = [
  { key: "top3", etiqueta: "Top 3", color: "var(--color-success)" },
  { key: "top10", etiqueta: "Top 10", color: "#2563eb" },
  { key: "top20", etiqueta: "Top 20", color: "var(--color-danger)" },
  { key: "top50", etiqueta: "Top 50", color: "var(--color-warning)" },
  { key: "mas50", etiqueta: "50+", color: "var(--color-muted-2)" },
];

export function DistribucionPosiciones({ datos }: { datos: DistribucionPosicionesData }) {
  if (datos.total === 0) return null;

  const segments = BUCKETS.map((b) => ({ pct: (datos[b.key] / datos.total) * 100, color: b.color }));

  return (
    <div className="flex items-center gap-5">
      <Donut segments={segments} size={84} centerLabel={String(datos.total)} />
      <div className="flex flex-col gap-1.5">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: b.color }} />
            {b.etiqueta}
            <span className="font-semibold text-ink">{datos[b.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
