"use client";

import { useState } from "react";
import { resincronizarTareasClickUp } from "@/lib/data/settings-actions";

export function ResincronizarClickUp() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);

  async function resincronizar() {
    setPending(true);
    setError(null);
    setResumen(null);
    let desde = 0;
    let revisadas = 0;
    let actualizadas = 0;
    let fallidas = 0;
    try {
      for (;;) {
        const r = await resincronizarTareasClickUp(desde);
        if (!r.ok) {
          setError(r.error ?? "No se pudo resincronizar.");
          return;
        }
        revisadas += r.revisadas;
        actualizadas += r.actualizadas;
        fallidas += r.fallidas;
        setResumen(`Revisadas ${revisadas}…`);
        if (r.restantes === 0 || r.revisadas === 0) break;
        desde += r.revisadas;
      }
      setResumen(`Listo: ${revisadas} tarea(s) revisadas, ${actualizadas} actualizadas${fallidas ? `, ${fallidas} con error (se reintentan solas con el job diario)` : ""}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resincronizar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="mb-1 text-[13px] font-bold">Resincronizar tareas de ClickUp</div>
      <p className="mb-3.5 text-[11.5px] text-muted-2">
        Vuelve a enviar a ClickUp la fecha, las etiquetas y el responsable de todas las optimizaciones pendientes. Úsalo después de cambiar responsables o de corregir el usuario de ClickUp de alguien. No crea tareas duplicadas.
      </p>
      {error && <div className="mb-3 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">{error}</div>}
      {resumen && <div className="mb-3 rounded-lg border border-success bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success">{resumen}</div>}
      <button onClick={resincronizar} disabled={pending} className="ghost rounded-lg border border-border bg-surface px-3.5 py-2 font-sans text-[12.5px] font-semibold text-ink disabled:opacity-60">
        {pending ? "Resincronizando…" : "Resincronizar ahora"}
      </button>
    </div>
  );
}
