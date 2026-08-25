const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

export function TablaKeywords({
  filas,
}: {
  filas: { termino: string; clics: number; impresiones: number; ctr: number; posicion: number }[];
}) {
  if (filas.length === 0) return <p className="text-[12px] text-muted-2">Sin keywords con datos en este período.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
            <th className="py-2 pr-3 font-semibold">Keyword</th>
            <th className="py-2 pr-3 text-right font-semibold">Pos.</th>
            <th className="py-2 pr-3 text-right font-semibold">Clics</th>
            <th className="py-2 pr-3 text-right font-semibold">Impr.</th>
            <th className="py-2 text-right font-semibold">CTR</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((k) => (
            <tr key={k.termino} className="border-b border-border-soft last:border-b-0">
              <td className="py-2 pr-3 text-ink">{k.termino}</td>
              <td className="py-2 pr-3 text-right text-muted [font-variant-numeric:tabular-nums]">{k.posicion.toFixed(1).replace(".", ",")}</td>
              <td className="py-2 pr-3 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">{fmtNumero(k.clics)}</td>
              <td className="py-2 pr-3 text-right text-muted [font-variant-numeric:tabular-nums]">{fmtNumero(k.impresiones)}</td>
              <td className="py-2 text-right text-muted [font-variant-numeric:tabular-nums]">{fmtPct(k.ctr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
