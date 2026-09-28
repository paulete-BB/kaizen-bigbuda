"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Ausencia } from "@/lib/data/ausencias";
import type { UsuarioResumen } from "@/lib/data/users";
import { crearAusencia, eliminarAusencia } from "@/lib/data/ausencias-actions";
import { fmtFecha, hoySantiago, toIso } from "@/lib/dates";

export function AusenciasPanel({
  ausencias,
  usuarios,
  esAdmin,
  usuarioActualId,
}: {
  ausencias: Ausencia[];
  usuarios: UsuarioResumen[];
  esAdmin: boolean;
  usuarioActualId: string;
}) {
  const router = useRouter();
  const hoyIso = toIso(hoySantiago());
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState({ userId: usuarioActualId, fechaInicio: hoyIso, fechaFin: hoyIso, motivo: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("userId", nuevo.userId);
    fd.set("fechaInicio", nuevo.fechaInicio);
    fd.set("fechaFin", nuevo.fechaFin);
    fd.set("motivo", nuevo.motivo);
    try {
      const res = await crearAusencia(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo registrar la ausencia.");
        return;
      }
      setAdding(false);
      setNuevo({ userId: usuarioActualId, fechaInicio: hoyIso, fechaFin: hoyIso, motivo: "" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function eliminar(a: Ausencia) {
    if (!confirm(`¿Eliminar la ausencia de ${a.usuarioNombre}?`)) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("ausenciaId", a.id);
    try {
      const res = await eliminarAusencia(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar la ausencia.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const hoy = hoySantiago();

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-bold">Ausencias del equipo</div>
        <button onClick={() => setAdding((v) => !v)} className="border-none bg-transparent font-sans text-[12px] font-semibold text-accent">
          {adding ? "Cancelar" : "+ Registrar ausencia"}
        </button>
      </div>
      <p className="mb-3.5 text-[11.5px] text-muted-2">
        Vacaciones y licencias (§3.2 D) — si el responsable de una optimización programada está ausente en esa fecha, el
        dashboard lo alerta y permite reasignar en un clic.
      </p>

      {error && <div className="mb-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>}

      {adding && (
        <div className="mb-4 flex flex-col gap-2.5 rounded-[10px] border border-border bg-[#fdfbf7] p-3.5">
          <div className="flex flex-wrap gap-2.5">
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Persona</span>
              <select
                disabled={!esAdmin}
                value={nuevo.userId}
                onChange={(e) => setNuevo((n) => ({ ...n, userId: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink disabled:bg-hover-2 disabled:text-muted"
              >
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Desde</span>
              <input
                type="date"
                value={nuevo.fechaInicio}
                onChange={(e) => setNuevo((n) => ({ ...n, fechaInicio: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              />
            </label>
            <label className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Hasta</span>
              <input
                type="date"
                value={nuevo.fechaFin}
                onChange={(e) => setNuevo((n) => ({ ...n, fechaFin: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              />
            </label>
          </div>
          <input
            type="text"
            value={nuevo.motivo}
            onChange={(e) => setNuevo((n) => ({ ...n, motivo: e.target.value }))}
            placeholder="Motivo (opcional) — vacaciones, licencia médica…"
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
          />
          <div>
            <button
              onClick={guardar}
              disabled={pending}
              className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Registrar ausencia"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {ausencias.length === 0 && <p className="py-4 text-center text-[12px] text-muted-2">Sin ausencias registradas.</p>}
        {ausencias.map((a) => {
          const vigente = a.fechaInicio <= toIso(hoy) && toIso(hoy) <= a.fechaFin;
          const puedeEliminar = esAdmin || a.userId === usuarioActualId;
          return (
            <div key={a.id} className="flex items-center gap-2.5 border-b border-border-soft-2 py-2 last:border-b-0">
              <span className="text-[12.5px] font-semibold">{a.usuarioNombre}</span>
              <span className="text-[12px] text-muted-2">
                {fmtFecha(a.fechaInicio)} → {fmtFecha(a.fechaFin)}
                {a.motivo ? ` · ${a.motivo}` : ""}
              </span>
              {vigente && <span className="rounded-full bg-warning-bg px-2 py-px text-[10.5px] font-semibold text-warning">En curso</span>}
              <div className="flex-1" />
              {puedeEliminar && (
                <button onClick={() => eliminar(a)} disabled={pending} className="border-none bg-transparent font-sans text-[11.5px] font-semibold text-danger disabled:opacity-60">
                  Eliminar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
