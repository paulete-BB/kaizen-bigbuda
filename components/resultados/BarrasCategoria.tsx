/**
 * Paleta categórica validada (dataviz skill, orden fijo por identidad —
 * nunca reciclada según qué fuentes aparezcan en el período). Fuentes de
 * IA no reconocidas (agrupadas o nuevas) caen a un gris neutro.
 */
const COLOR_POR_FUENTE: Record<string, string> = {
  "chatgpt.com": "#2a78d6",
  "chat.openai.com": "#2a78d6",
  "perplexity.ai": "#eb6834",
  "gemini.google.com": "#1baf7a",
  "claude.ai": "#eda100",
  "copilot.microsoft.com": "#e87ba4",
};
const COLOR_OTRA_FUENTE = "#9ca3af";

function colorFuente(fuente: string): string {
  const match = Object.keys(COLOR_POR_FUENTE).find((dominio) => fuente.toLowerCase().includes(dominio));
  return match ? COLOR_POR_FUENTE[match] : COLOR_OTRA_FUENTE;
}

export function BarrasCategoria({ filas, formato = (n) => String(n) }: { filas: { fuente: string; sesiones: number }[]; formato?: (n: number) => string }) {
  if (filas.length === 0) return <p className="text-[12px] text-muted-2">Sin sesiones desde fuentes de IA en este período.</p>;
  const maxValor = Math.max(1, ...filas.map((f) => f.sesiones));

  return (
    <div className="flex flex-col gap-2">
      {filas.map((f) => (
        <div key={f.fuente} className="flex items-center gap-2.5">
          <div className="flex w-[150px] flex-none items-center gap-1.5 truncate text-[11.5px] text-muted" title={f.fuente}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: colorFuente(f.fuente) }} />
            {f.fuente}
          </div>
          <div className="relative h-4 flex-1 overflow-hidden rounded-[4px] bg-border-soft">
            <div className="h-full rounded-[4px]" style={{ width: `${Math.max(2, (f.sesiones / maxValor) * 100)}%`, background: colorFuente(f.fuente) }} />
          </div>
          <div className="w-[56px] flex-none text-right text-[11.5px] font-semibold text-ink">{formato(f.sesiones)}</div>
        </div>
      ))}
    </div>
  );
}
