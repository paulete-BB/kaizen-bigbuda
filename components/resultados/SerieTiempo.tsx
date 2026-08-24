"use client";

import { useMemo, useRef, useState } from "react";
import type { Hito, PuntoSerie } from "@/lib/data/resultados";
import { fmtFecha } from "@/lib/dates";
import { formatearValor, type FormatoValor } from "@/lib/resultados-formato";

const ALTO = 200;
const ANCHO = 640;
const PAD = { top: 12, right: 12, bottom: 20, left: 12 };

function construirPath(puntos: { x: number; y: number }[]) {
  return puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function SerieTiempo({
  serie,
  hitos,
  color,
  formato = "numero",
}: {
  serie: PuntoSerie[];
  hitos: Hito[];
  color: string;
  formato?: FormatoValor;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { puntos, hitosPorFecha } = useMemo(() => {
    const maxValor = Math.max(1, ...serie.map((p) => p.valor));
    const anchoUtil = ANCHO - PAD.left - PAD.right;
    const altoUtil = ALTO - PAD.top - PAD.bottom;
    const puntos = serie.map((p, i) => ({
      x: PAD.left + (serie.length > 1 ? (i / (serie.length - 1)) * anchoUtil : anchoUtil / 2),
      y: PAD.top + altoUtil - (p.valor / maxValor) * altoUtil,
      valor: p.valor,
    }));
    const hitosPorFecha = new Map(hitos.map((h) => [h.fecha, h]));
    return { puntos, hitosPorFecha };
  }, [serie, hitos]);

  if (serie.length === 0) return null;

  const linea = construirPath(puntos);
  const area = `${linea} L${puntos[puntos.length - 1].x.toFixed(1)},${ALTO - PAD.bottom} L${puntos[0].x.toFixed(1)},${ALTO - PAD.bottom} Z`;
  const activo = hoverIdx !== null ? puntos[hoverIdx] : null;
  const activoFecha = hoverIdx !== null ? serie[hoverIdx] : null;
  const activoHito = activoFecha ? hitosPorFecha.get(activoFecha.fecha) : null;

  function moverPuntero(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRelativo = ((clientX - rect.left) / rect.width) * ANCHO;
    const anchoUtil = ANCHO - PAD.left - PAD.right;
    const paso = serie.length > 1 ? anchoUtil / (serie.length - 1) : anchoUtil;
    const idx = Math.round((xRelativo - PAD.left) / paso);
    setHoverIdx(Math.min(serie.length - 1, Math.max(0, idx)));
  }

  return (
    <div className="relative w-full" style={{ maxWidth: ANCHO }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full"
        style={{ height: ALTO, touchAction: "none" }}
        onPointerMove={(e) => moverPuntero(e.clientX)}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* gridlines: 0 y máximo */}
        <line x1={PAD.left} x2={ANCHO - PAD.right} y1={ALTO - PAD.bottom} y2={ALTO - PAD.bottom} stroke="var(--color-border)" strokeWidth={1} />

        {/* hitos: línea vertical punteada + punto arriba */}
        {puntos.map((p, i) => {
          const hito = hitosPorFecha.get(serie[i].fecha);
          if (!hito) return null;
          return (
            <g key={i}>
              <line x1={p.x} x2={p.x} y1={PAD.top} y2={ALTO - PAD.bottom} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3,3" opacity={0.55} />
              <circle cx={p.x} cy={PAD.top} r={3} fill="var(--color-accent)" />
            </g>
          );
        })}

        <path d={area} fill={color} opacity={0.1} stroke="none" />
        <path d={linea} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {activo && (
          <>
            <line x1={activo.x} x2={activo.x} y1={PAD.top} y2={ALTO - PAD.bottom} stroke="var(--color-muted-2)" strokeWidth={1} />
            <circle cx={activo.x} cy={activo.y} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
          </>
        )}
      </svg>

      {activo && activoFecha && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] shadow-sm"
          style={{
            left: `${Math.min(85, Math.max(2, (activo.x / ANCHO) * 100))}%`,
            top: 4,
            transform: activo.x / ANCHO > 0.7 ? "translateX(-100%)" : undefined,
          }}
        >
          <div className="font-semibold text-ink">{formatearValor(activoFecha.valor, formato)}</div>
          <div className="text-muted-2">{fmtFecha(activoFecha.fecha)}</div>
          {activoHito && <div className="mt-0.5 font-semibold text-accent">{activoHito.etiqueta}</div>}
        </div>
      )}
    </div>
  );
}
