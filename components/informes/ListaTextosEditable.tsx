"use client";

/** Como ListaEditable pero para arrays de strings simples (bullets) — no tiene sentido "spreadear" un string, así que es un componente aparte. */
export function ListaTextosEditable({ items, onChange, addLabel }: { items: string[]; onChange: (items: string[]) => void; addLabel: string }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((texto, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={texto}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="xbtn rounded-md px-2 py-1 text-[12px] text-muted-2" aria-label="Quitar">
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="ghost self-start rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] font-semibold text-muted"
      >
        + {addLabel}
      </button>
    </div>
  );
}
