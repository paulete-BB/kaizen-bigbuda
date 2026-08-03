"use client";

import { useState } from "react";
import type { Descuento } from "@/lib/clientes/types";
import { addMeses, diasHasta, fmtFecha, hoySantiago } from "@/lib/clientes/date-utils";

interface DescuentosPanelProps {
  descuentos: Descuento[];
  onLogCambio: (titulo: string, desc: string, tipo: string) => void;
}

export function DescuentosPanel({ descuentos: descuentosIniciales, onLogCambio }: DescuentosPanelProps) {
  const [descuentos, setDescuentos] = useState(descuentosIniciales);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ pct: "0", vence: "" });
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", pct: "10", vence: "2026-12-31" });
  const hoy = hoySantiago();

  function toggleEdit(d: Descuento) {
    if (editingId === d.id) {
      setEditingId(null);
      return;
    }
    setEditingId(d.id);
    setDraft({ pct: String(d.pct), vence: d.vence });
  }

  function save(d: Descuento) {
    const pct = Number(draft.pct) || d.pct;
    const vence = draft.vence;
    const antes = d.vence;
    setDescuentos((prev) => prev.map((x) => (x.id === d.id ? { ...x, pct, vence } : x)));
    setEditingId(null);
    onLogCambio(
      `${d.nombre} actualizado`,
      `Descuento −${pct}% · caducidad de ${fmtFecha(antes)} a ${fmtFecha(vence)}.`,
      "Descuento",
    );
  }

  function remove(d: Descuento) {
    setDescuentos((prev) => prev.filter((x) => x.id !== d.id));
    setEditingId(null);
    onLogCambio(`${d.nombre} terminado`, `Descuento −${d.pct}% cerrado antes de su caducidad.`, "Descuento");
  }

  function saveNuevo() {
    if (!nuevo.nombre.trim()) return;
    const pct = Number(nuevo.pct) || 10;
    setDescuentos((prev) => [...prev, { id: `d${Date.now()}`, nombre: nuevo.nombre.trim(), pct, vence: nuevo.vence }]);
    setAdding(false);
    onLogCambio(
      `Descuento nuevo · ${nuevo.nombre.trim()}`,
      `−${pct}% vigente hasta ${fmtFecha(nuevo.vence)}.`,
      "Descuento",
    );
    setNuevo({ nombre: "", pct: "10", vence: "2026-12-31" });
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Descuentos</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="border-none bg-transparent font-sans text-[12px] font-semibold text-accent"
        >
          {adding ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2.5 border-b border-border-soft bg-[#fdfbf7] px-[18px] py-[15px]">
          <input
            type="text"
            value={nuevo.nombre}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            placeholder="Nombre del descuento"
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
          />
          <div className="flex gap-2.5">
            <label className="flex w-[92px] flex-none flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Porcentaje</span>
              <input
                type="number"
                min={1}
                max={100}
                value={nuevo.pct}
                onChange={(e) => setNuevo((n) => ({ ...n, pct: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Vence</span>
              <input
                type="date"
                value={nuevo.vence}
                onChange={(e) => setNuevo((n) => ({ ...n, vence: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              />
            </label>
          </div>
          <button
            onClick={saveNuevo}
            className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white"
          >
            Guardar descuento
          </button>
        </div>
      )}

      <div className="px-[18px] py-1.5 pb-3">
        {descuentos.map((d) => {
          const n = diasHasta(d.vence, hoy);
          const terminado = n < 0;
          const porVencer = !terminado && n <= 20;
          const editing = editingId === d.id;
          const estadoLabel = terminado ? "Terminado" : porVencer ? "Por vencer" : "Activo";
          const estadoFg = terminado ? "var(--color-muted-2)" : porVencer ? "var(--color-warning)" : "var(--color-success)";
          const estadoBg = terminado ? "var(--color-border-soft)" : porVencer ? "var(--color-warning-bg)" : "var(--color-success-bg)";
          const venceLabel = terminado ? `Terminado el ${fmtFecha(d.vence)}` : porVencer ? `Vence en ${n} días` : `Vence ${fmtFecha(d.vence)}`;

          return (
            <div key={d.id} className="editrow border-b border-border-soft-2 py-[13px]">
              <div className="flex items-center gap-3">
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-[#fdf0dd] text-[#b45309]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4l11 11 6-6L9 3z" />
                    <circle cx="7.5" cy="7.5" r="1.2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">
                    {d.nombre} · −{d.pct}%
                  </div>
                  <div className="text-[11.5px]" style={{ color: porVencer ? "var(--color-warning)" : "var(--color-muted-2)" }}>
                    {venceLabel}
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: estadoFg, background: estadoBg }}>
                  {estadoLabel}
                </span>
                <button
                  onClick={() => toggleEdit(d)}
                  className="rowedit flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border-none bg-transparent text-muted-2"
                  title="Editar caducidad"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M4 20h4l10-10-4-4L4 16z" />
                    <path d="M13.5 5.5l4 4" />
                  </svg>
                </button>
              </div>

              {editing && (
                <div className="mt-2.5 flex flex-col gap-2.5 rounded-[10px] border border-[#f0e6d2] bg-[#fdfbf7] p-3">
                  <div className="flex gap-2.5">
                    <label className="flex w-[86px] flex-none flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-2">Porcentaje</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={draft.pct}
                        onChange={(e) => setDraft((s) => ({ ...s, pct: e.target.value }))}
                        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-ink"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-2">Vence</span>
                      <input
                        type="date"
                        value={draft.vence}
                        onChange={(e) => setDraft((s) => ({ ...s, vence: e.target.value }))}
                        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-ink"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 3, 6].map((n2) => (
                      <button
                        key={n2}
                        onClick={() => setDraft((s) => ({ ...s, vence: addMeses(d.vence, n2) }))}
                        className="preset rounded-lg border border-border bg-surface px-2.5 py-1 font-sans text-[11.5px] font-semibold text-ink"
                      >
                        +{n2} {n2 === 1 ? "mes" : "meses"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => save(d)}
                      className="btn-primary rounded-lg border-none bg-accent px-3 py-2 font-sans text-[12px] font-semibold text-white"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => toggleEdit(d)}
                      className="ghost rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[12px] font-semibold text-muted"
                    >
                      Cancelar
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => remove(d)}
                      className="rounded-lg border border-danger-border bg-surface px-3 py-2 font-sans text-[12px] font-semibold text-danger"
                    >
                      Terminar ahora
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
