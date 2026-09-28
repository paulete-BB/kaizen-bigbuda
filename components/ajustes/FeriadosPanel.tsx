"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeriadoDetalle } from "@/lib/data/holidays";
import { crearFeriado, eliminarFeriado } from "@/lib/data/holidays-actions";
import { fmtFecha, hoySantiago, toIso } from "@/lib/dates";

export function FeriadosPanel({ feriados, esAdmin }: { feriados: FeriadoDetalle[]; esAdmin: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState({ fecha: toIso(hoySantiago()), nombre: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    if (!nuevo.nombre.trim()) return;
    setPending(true);
    setError(null);
    setAviso(null);
    const fd = new FormData();
    fd.set("fecha", nuevo.fecha);
    fd.set("nombre", nuevo.nombre.trim());
    try {
      const res = await crearFeriado(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo agregar el feriado.");
        return;
      }
      setAdding(false);
      setNuevo({ fecha: toIso(hoySantiago()), nombre: "" });
      if (res.reprogramadas) {
        setAviso(`${res.reprogramadas} optimización${res.reprogramadas === 1 ? "" : "es"} ya programada${res.reprogramadas === 1 ? "" : "s"} para esa fecha se reprogramó${res.reprogramadas === 1 ? "" : "ron"} automáticamente.`);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function eliminar(f: FeriadoDetalle) {
    if (!confirm(`¿Eliminar el feriado "${f.nombre}" (${fmtFecha(f.fecha)})?`)) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("feriadoId", f.id);
    try {
      const res = await eliminarFeriado(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar el feriado.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-bold">Feriados de Chile</div>
        {esAdmin && (
          <button onClick={() => setAdding((v) => !v)} className="border-none bg-transparent font-sans text-[12px] font-semibold text-accent">
            {adding ? "Cancelar" : "+ Agregar feriado"}
          </button>
        )}
      </div>
      <p className="mb-3.5 text-[11.5px] text-muted-2">
        Si una optimización ya programada cae en un feriado que se agrega acá, se reprograma automáticamente (SEO → viernes
        anterior con cupo; Ads → día hábil siguiente) y la tarea de ClickUp se actualiza.
      </p>

      {error && <div className="mb-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>}
      {aviso && <div className="mb-3 rounded-lg border border-success bg-success-bg px-3 py-2 text-[12px] font-semibold text-success">{aviso}</div>}

      {adding && (
        <div className="mb-4 flex flex-col gap-2.5 rounded-[10px] border border-border bg-[#fdfbf7] p-3.5">
          <div className="flex flex-wrap gap-2.5">
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Fecha</span>
              <input
                type="date"
                value={nuevo.fecha}
                onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              />
            </label>
            <label className="flex min-w-[180px] flex-[2] flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Nombre</span>
              <input
                type="text"
                value={nuevo.nombre}
                onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
                placeholder="Ej. Día de la Independencia"
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              />
            </label>
          </div>
          <div>
            <button
              onClick={guardar}
              disabled={pending}
              className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Agregar feriado"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {feriados.length === 0 && <p className="py-4 text-center text-[12px] text-muted-2">Sin feriados registrados.</p>}
        {feriados.map((f) => (
          <div key={f.id} className="flex items-center gap-2.5 border-b border-border-soft-2 py-2 last:border-b-0">
            <span className="text-[12.5px] font-semibold">{fmtFecha(f.fecha)}</span>
            <span className="text-[12px] text-muted-2">{f.nombre}</span>
            <div className="flex-1" />
            {esAdmin && (
              <button onClick={() => eliminar(f)} disabled={pending} className="border-none bg-transparent font-sans text-[11.5px] font-semibold text-danger disabled:opacity-60">
                Eliminar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
