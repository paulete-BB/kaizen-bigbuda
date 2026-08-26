"use client";

import { useMemo, useRef, useState } from "react";
import type { SerieFuenteIA } from "@/lib/data/resultados";
import { colorFuenteIA } from "@/lib/resultados-colores-ia";

const ALTO = 200;
const ANCHO = 640;
const PAD = { top: 12, right: 12, bottom: 28, left: 12 };

function construirPath(puntos: { x: number; y: number }[]) {
  return puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/**
 * Tendencia semanal de sesiones por fuente de IA — reemplaza la barra
 * horizontal por línea (una por modelo, con marcador circular en cada
 * semana), igual que el panel de referencia real. A diferencia de
 * `SerieTiempo` (máximo 2 series), acá el número de series es variable
 * (una por fuente detectada en el período), así que necesita su propio
 * componente en vez de extender el existente.
 */
export function TendenciaFuentesIA({ series }: { series: SerieFuenteIA[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const totalSesiones = series.reduce((s, serie) => s + serie.puntos.reduce((s2, p) => s2 + p.valor, 0), 0);

  const { semanas, lineas, etiquetasX } = useMemo(() => {
    const semanas = series[0]?.puntos ?? [];
    const maxValor = Math.max(1, ...series.flatMap((s) => s.puntos.map((p) => p.valor)));
    const anchoUtil = ANCHO - PAD.left - PAD.right;
    const altoUtil = ALTO - PAD.top - PAD.bottom;
    const n = semanas.length;
    const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * anchoUtil : anchoUtil / 2);
    const y = (valor: number) => PAD.top + altoUtil - (valor / maxValor) * altoUtil;
    const lineas = series.map((s) => ({
      fuente: s.fuente,
      color: colorFuenteIA(s.fuente),
      puntos: s.puntos.map((p, i) => ({ x: x(i), y: y(p.valor), valor: p.valor })),
    }));
    // No etiquetar cada semana si son muchas: se satura el eje X.
    const paso = Math.max(1, Math.ceil(n / 6));
    const etiquetasX = semanas
      .map((p, i) =>
        i % paso === 0 || i === n - 1
          ? { x: x(i), texto: p.etiqueta, anchor: i === 0 ? ("start" as const) : i === n - 1 ? ("end" as const) : ("middle" as const) }
          : null,
      )
      .filter((v): v is { x: number; texto: string; anchor: "start" | "middle" | "end" } => v !== null);
    return { semanas, lineas, etiquetasX };
  }, [series]);

  if (semanas.length === 0 || totalSesiones === 0) {
    return <p className="text-[12px] text-muted-2">Sin sesiones desde fuentes de IA en este período.</p>;
  }

  function moverPuntero(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRelativo = ((clientX - rect.left) / rect.width) * ANCHO;
    const anchoUtil = ANCHO - PAD.left - PAD.right;
    const n = semanas.length;
    const paso = n > 1 ? anchoUtil / (n - 1) : anchoUtil;
    const idx = Math.round((xRelativo - PAD.left) / paso);
    setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
  }

  const activoX = hoverIdx !== null ? lineas[0]?.puntos[hoverIdx]?.x : undefined;

  return (
    <div className="relative w-full" style={{ maxWidth: ANCHO }}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {lineas.map((l) => (
          <span key={l.fuente} className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-none rounded-full border-2" style={{ borderColor: l.color, background: "var(--color-surface)" }} />
            {l.fuente}
          </span>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full"
        style={{ height: ALTO, touchAction: "none" }}
        onPointerMove={(e) => moverPuntero(e.clientX)}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <line x1={PAD.left} x2={ANCHO - PAD.right} y1={ALTO - PAD.bottom} y2={ALTO - PAD.bottom} stroke="var(--color-border)" strokeWidth={1} />

        {activoX !== undefined && (
          <line x1={activoX} x2={activoX} y1={PAD.top} y2={ALTO - PAD.bottom} stroke="var(--color-muted-2)" strokeWidth={1} />
        )}

        {lineas.map((l) => (
          <g key={l.fuente}>
            <path d={construirPath(l.puntos)} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {l.puntos.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 4 : 3} fill="var(--color-surface)" stroke={l.color} strokeWidth={2} />
            ))}
          </g>
        ))}

        {etiquetasX.map((e, i) => (
          <text key={i} x={e.x} y={ALTO - 6} textAnchor={e.anchor} fontSize={10} fill="var(--color-muted-2)">
            {e.texto}
          </text>
        ))}
      </svg>

      {hoverIdx !== null && activoX !== undefined && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] shadow-sm"
          style={{
            left: `${Math.min(85, Math.max(2, (activoX / ANCHO) * 100))}%`,
            top: 4,
            transform: activoX / ANCHO > 0.7 ? "translateX(-100%)" : undefined,
          }}
        >
          {lineas.map((l) => (
            <div key={l.fuente} className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="h-0.5 w-2.5 flex-none" style={{ background: l.color }} />
              {l.fuente}: {Math.round(l.puntos[hoverIdx].valor)}
            </div>
          ))}
          <div className="mt-0.5 text-muted-2">{semanas[hoverIdx].etiqueta}</div>
        </div>
      )}
    </div>
  );
}
