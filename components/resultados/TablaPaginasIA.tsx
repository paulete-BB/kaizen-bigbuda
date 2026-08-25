const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");

export function TablaPaginasIA({ filas }: { filas: { pagina: string; sesiones: number; conversiones: number }[] }) {
  if (filas.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
            <th className="py-2 pr-3 font-semibold">Página de aterrizaje</th>
            <th className="py-2 pr-3 text-right font-semibold">Sesiones</th>
            <th className="py-2 text-right font-semibold">Conversiones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.pagina} className="border-b border-border-soft last:border-b-0">
              <td className="py-2 pr-3 text-ink">{p.pagina}</td>
              <td className="py-2 pr-3 text-right text-muted [font-variant-numeric:tabular-nums]">{fmtNumero(p.sesiones)}</td>
              <td className="py-2 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">{fmtNumero(p.conversiones)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
