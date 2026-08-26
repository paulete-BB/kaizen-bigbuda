import type { FilaCampana } from "@/lib/data/resultados";

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
// Sin Math.round: el costo por conversión suele ser menor a la unidad — ver el
// mismo comentario en lib/data/resultados.ts.
const fmtMoneda = (n: number, moneda: string) => `${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${moneda}`;

export function TablaCampanas({
  filas,
  etiquetaInteracciones,
  moneda,
}: {
  filas: FilaCampana[];
  etiquetaInteracciones: string;
  moneda: string;
}) {
  if (filas.length === 0) return <p className="text-[12px] text-muted-2">Sin campañas con datos en este período.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
            <th className="py-2 pr-3 font-semibold">Campaña</th>
            <th className="py-2 pr-3 text-right font-semibold">{etiquetaInteracciones}</th>
            <th className="py-2 pr-3 text-right font-semibold">Conversiones</th>
            <th className="py-2 pr-3 text-right font-semibold">Tasa conv.</th>
            <th className="py-2 text-right font-semibold">Costo/conv.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} className="border-b border-border-soft last:border-b-0">
              <td className="py-2 pr-3 text-ink">{f.nombre}</td>
              <td className="py-2 pr-3 text-right text-muted [font-variant-numeric:tabular-nums]">{fmtNumero(f.interacciones)}</td>
              <td className="py-2 pr-3 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">{fmtNumero(f.conversiones)}</td>
              <td className="py-2 pr-3 text-right text-muted [font-variant-numeric:tabular-nums]">{fmtPct(f.tasaConversion)}</td>
              <td className="py-2 text-right text-muted [font-variant-numeric:tabular-nums]">{f.costoPorConversion !== null ? fmtMoneda(f.costoPorConversion, moneda) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
