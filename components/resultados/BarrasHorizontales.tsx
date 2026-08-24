export function BarrasHorizontales({
  filas,
  color = "var(--color-accent)",
  formato = (n) => String(n),
}: {
  filas: { etiqueta: string; valor: number }[];
  color?: string;
  formato?: (n: number) => string;
}) {
  if (filas.length === 0) return <p className="text-[12px] text-muted-2">Sin datos para este período.</p>;
  const maxValor = Math.max(1, ...filas.map((f) => f.valor));

  return (
    <div className="flex flex-col gap-2">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center gap-2.5">
          <div className="w-[130px] flex-none truncate text-[11.5px] text-muted" title={f.etiqueta}>
            {f.etiqueta}
          </div>
          <div className="relative h-4 flex-1 overflow-hidden rounded-[4px] bg-border-soft">
            <div
              className="h-full rounded-[4px]"
              style={{ width: `${Math.max(2, (f.valor / maxValor) * 100)}%`, background: color, opacity: 0.85 }}
            />
          </div>
          <div className="w-[64px] flex-none text-right text-[11.5px] font-semibold text-ink">{formato(f.valor)}</div>
        </div>
      ))}
    </div>
  );
}
