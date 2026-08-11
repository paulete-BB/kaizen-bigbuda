"use client";

import type { ReactNode } from "react";

/** Editor genérico de arrays de objetos (decisiones, métricas, bullets, pasos, etc.) — mismo add/remove para todas las secciones del informe. */
export function ListaEditable<T>({
  items,
  vacio,
  onChange,
  render,
  addLabel,
}: {
  items: T[];
  vacio: T;
  onChange: (items: T[]) => void;
  render: (item: T, onUpdate: (patch: Partial<T>) => void, index: number) => ReactNode;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border-soft-2 p-3">
          <div className="flex-1">{render(item, (patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))), i)}</div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="xbtn rounded-md px-2 py-1 text-[12px] text-muted-2"
            aria-label="Quitar"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, vacio])}
        className="ghost self-start rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] font-semibold text-muted"
      >
        + {addLabel}
      </button>
    </div>
  );
}
