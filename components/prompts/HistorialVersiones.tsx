"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restaurarVersionPrompt } from "@/lib/data/prompts-actions";
import type { PromptVersion } from "@/lib/data/prompts";

function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function HistorialVersiones({ promptId, versionActual, versiones }: { promptId: string; versionActual: number; versiones: PromptVersion[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<number | null>(null);
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restaurar(version: number) {
    if (!confirm(`¿Restaurar la versión ${version}? El contenido actual queda guardado en el historial.`)) return;
    setRestaurando(version);
    setError(null);
    const fd = new FormData();
    fd.set("id", promptId);
    fd.set("version", String(version));
    const res = await restaurarVersionPrompt(fd);
    if (!res.ok) {
      setError(res.error ?? "No se pudo restaurar.");
      setRestaurando(null);
      return;
    }
    router.refresh();
    setRestaurando(null);
  }

  if (versiones.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface p-5">
        <div className="text-[13px] font-bold">Historial de versiones</div>
        <p className="mt-1.5 text-[12px] text-muted-2">Todavía no hay ediciones — esta es la versión {versionActual}.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <div className="text-[13px] font-bold">Historial de versiones</div>
      {error && <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>}
      <div className="flex flex-col gap-2">
        {versiones.map((v) => (
          <div key={v.version} className="rounded-[10px] border border-border-soft p-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[12.5px] font-semibold text-ink">Versión {v.version}</span>
              <span className="text-[11px] text-muted-2">
                {fmtFechaHora(v.guardadoEn)}
                {v.guardadoPor ? ` · ${v.guardadoPor}` : ""}
              </span>
              <div className="flex-1" />
              <button onClick={() => setAbierta(abierta === v.version ? null : v.version)} className="text-[11.5px] font-semibold text-muted">
                {abierta === v.version ? "Ocultar" : "Ver"}
              </button>
              <button
                onClick={() => restaurar(v.version)}
                disabled={restaurando === v.version}
                className="text-[11.5px] font-semibold text-accent disabled:opacity-60"
              >
                {restaurando === v.version ? "Restaurando…" : "Restaurar"}
              </button>
            </div>
            {abierta === v.version && (
              <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg bg-border-soft-2 p-2.5 font-mono text-[11.5px] text-ink">
                {v.contenido}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
