import type { Funnel as FunnelData } from "@/lib/data/resultados";

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

function Etapa({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[20px] font-bold leading-none ${destacado ? "text-accent" : "text-ink"}`}>{valor}</span>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">{etiqueta}</span>
    </div>
  );
}

function Flecha({ pct }: { pct: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span className="text-[11px] font-semibold text-muted">{fmtPct(pct)}</span>
      <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" className="w-full text-border">
        <line x1="0" y1="5" x2="94" y2="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M90 1.5 L96 5 L90 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Funnel({ funnel }: { funnel: FunnelData }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-5 py-4">
      <Etapa etiqueta="Impresiones" valor={fmtNumero(funnel.impresiones)} />
      <Flecha pct={funnel.pctImpresionesAClics} />
      <Etapa etiqueta="Clics" valor={fmtNumero(funnel.clics)} destacado />
      <Flecha pct={funnel.pctClicsAConversiones} />
      <Etapa etiqueta="Conversiones" valor={fmtNumero(funnel.conversiones)} />
    </div>
  );
}
