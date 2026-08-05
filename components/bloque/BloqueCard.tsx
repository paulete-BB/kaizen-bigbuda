"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemBloque } from "@/lib/data/bloque";
import { completarServicioBloque, guardarAvanceBloque, toggleChecklistItemBloque } from "@/lib/data/bloque-actions";

const TIPO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  meta_ads: { label: "Meta Ads", color: "#2563eb", bg: "#e8f0fe" },
  google_ads: { label: "Google Ads", color: "#0d9488", bg: "#e3f4f2" },
};

export function BloqueCard({ item, fecha, mes, anio, defaultOpen = false }: { item: ItemBloque; fecha: string; mes: number; anio: number; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [notas, setNotas] = useState(item.notas ?? "");
  const [gasto, setGasto] = useState(item.gastoAcumulado ? String(item.gastoAcumulado) : "");
  const [pending, setPending] = useState(false);
  const canal = TIPO_LABEL[item.tipo];
  const completado = item.estado === "realizada";
  const done = item.checklist.filter((c) => c.completado).length;

  const pacing = item.presupuesto && gasto ? Math.round((Number(gasto) / item.presupuesto) * 100) : item.pacingPct;
  const desviacion = pacing != null ? pacing - 100 : null;
  const desviacionColor = desviacion == null ? "var(--color-muted)" : desviacion > 15 ? "var(--color-danger)" : desviacion < -15 ? "var(--color-warning)" : "var(--color-success)";

  async function toggleItem(itemId: string) {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("fecha", fecha);
    await toggleChecklistItemBloque(fd);
    router.refresh();
  }

  async function guardarAvance() {
    setPending(true);
    const fd = new FormData();
    fd.set("optimizationId", item.optimizationId);
    fd.set("fecha", fecha);
    fd.set("notas", notas);
    fd.set("serviceId", item.serviceId);
    fd.set("gasto", gasto);
    fd.set("mes", String(mes));
    fd.set("anio", String(anio));
    try {
      await guardarAvanceBloque(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function completar() {
    setPending(true);
    const fd = new FormData();
    fd.set("optimizationId", item.optimizationId);
    fd.set("fecha", fecha);
    fd.set("clientId", item.clienteId);
    fd.set("tipoLabel", canal.label);
    try {
      await completarServicioBloque(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: canal.color }} />
        <span className="text-[13.5px] font-semibold">{item.clienteNombre}</span>
        <span className="rounded-full px-2 py-px text-[10.5px] font-semibold" style={{ color: canal.color, background: canal.bg }}>
          {canal.label}
        </span>
        <span className="text-[12px] text-muted-2">
          {item.presupuesto ? `$${Number(item.presupuesto).toLocaleString("es-CL")}` : "—"} · {done} de {item.checklist.length} pasos
        </span>
        <div className="flex-1" />
        {completado ? (
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success">Completado</span>
        ) : desviacion != null ? (
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: desviacionColor, background: "var(--color-border-soft)" }}>
            Ritmo {desviacion >= 0 ? "+" : ""}
            {desviacion}%
          </span>
        ) : null}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" strokeWidth="2" style={{ transform: open ? "rotate(180deg)" : undefined }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-border-soft p-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-bold uppercase text-faint [letter-spacing:.03em]">Checklist estándar</div>
            <div className="flex flex-col gap-2">
              {item.checklist.map((c) => (
                <button key={c.id} onClick={() => toggleItem(c.id)} className="flex items-center gap-2 text-left text-[12.5px]">
                  <span
                    className="flex h-[16px] w-[16px] flex-none items-center justify-center rounded-[4px] border-[1.6px]"
                    style={{ borderColor: c.completado ? "var(--color-success)" : "var(--color-border)", background: c.completado ? "var(--color-success)" : "transparent" }}
                  >
                    {c.completado && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                        <path d="M5 12l4 4 10-11" />
                      </svg>
                    )}
                  </span>
                  <span style={{ textDecoration: c.completado ? "line-through" : undefined, color: c.completado ? "var(--color-muted-2)" : undefined }}>
                    {c.descripcion}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Notas</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink" />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-bold uppercase text-faint [letter-spacing:.03em]">Ritmo de gasto en vivo</div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Gasto acumulado del mes</span>
              <input type="number" value={gasto} onChange={(e) => setGasto(e.target.value)} className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink" />
            </label>
            {pacing != null && (
              <>
                <div className="h-2 overflow-hidden rounded-md bg-border-soft">
                  <div className="h-full rounded-md" style={{ width: `${Math.min(100, pacing)}%`, background: desviacionColor }} />
                </div>
                <div className="text-[11.5px] font-semibold" style={{ color: desviacionColor }}>
                  {desviacion! >= 0 ? "+" : ""}
                  {desviacion}% vs. ideal
                </div>
              </>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={guardarAvance} disabled={pending} className="ghost rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[12px] font-semibold text-ink disabled:opacity-60">
                Guardar avance
              </button>
              {!completado && (
                <button onClick={completar} disabled={pending} className="btn-primary rounded-lg border-none bg-accent px-3 py-2 font-sans text-[12px] font-semibold text-white disabled:opacity-60">
                  Completar servicio
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
