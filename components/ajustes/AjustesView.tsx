"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import type { Settings } from "@/lib/data/settings";
import { guardarAjustes } from "@/lib/data/settings-actions";

export function AjustesView({
  usuario,
  esAdmin,
  settings,
}: {
  usuario: SidebarUsuario;
  esAdmin: boolean;
  settings: Settings;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    clickupWorkspaceId: settings.clickupWorkspaceId ?? "",
    clickupDefaultListId: settings.clickupDefaultListId ?? "",
    diasAlertaDescuento: String(settings.diasAlertaDescuento),
    diasAlertaVencimientoServicio: String(settings.diasAlertaVencimientoServicio),
    umbralPacingPct: String(settings.umbralPacingPct),
    diasAlertaAprobacion: String(settings.diasAlertaAprobacion),
    diasAlertaOnboarding: String(settings.diasAlertaOnboarding),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function set<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setGuardado(false);
  }

  async function guardar() {
    setPending(true);
    setError(null);
    setGuardado(false);
    const fd = new FormData();
    Object.entries(draft).forEach(([k, v]) => fd.set(k, v));
    try {
      const res = await guardarAjustes(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="ajustes" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-[26px]">
          <div>
            <div className="text-[14px] font-bold">Ajustes</div>
            <div className="text-[11.5px] text-muted-2">Configuración general de la plataforma</div>
          </div>
        </header>

        <div className="flex w-full max-w-[760px] flex-col gap-5 px-[26px] pb-10 pt-[22px]">
          {!esAdmin && (
            <div className="rounded-lg border border-warning-border bg-warning-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-warning">
              Solo lectura — pídele a un admin que haga cambios aquí.
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">{error}</div>
          )}
          {guardado && (
            <div className="rounded-lg border border-success bg-success-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-success">
              Ajustes guardados.
            </div>
          )}

          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="mb-1 text-[13px] font-bold">ClickUp</div>
            <p className="mb-3.5 text-[11.5px] text-muted-2">
              Punto de integración preparado para Fase 2 — todavía no se conecta a la API real de ClickUp.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Workspace ID</span>
                <input
                  disabled={!esAdmin}
                  value={draft.clickupWorkspaceId}
                  onChange={(e) => set("clickupWorkspaceId", e.target.value)}
                  placeholder="Ej. 90131234567"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                />
              </label>
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Lista global "Operaciones" (default)</span>
                <input
                  disabled={!esAdmin}
                  value={draft.clickupDefaultListId}
                  onChange={(e) => set("clickupDefaultListId", e.target.value)}
                  placeholder="Ej. 901300123456"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="mb-1 text-[13px] font-bold">Alertas</div>
            <p className="mb-3.5 text-[11.5px] text-muted-2">
              Días de anticipación antes de marcar algo "por vencer" o disparar una alerta en el dashboard.
            </p>
            <div className="grid grid-cols-2 gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Descuento por vencer</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={!esAdmin}
                    value={draft.diasAlertaDescuento}
                    onChange={(e) => set("diasAlertaDescuento", e.target.value)}
                    className="w-[90px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                  />
                  <span className="text-[12px] text-muted-2">días antes</span>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Servicio por vencer</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={!esAdmin}
                    value={draft.diasAlertaVencimientoServicio}
                    onChange={(e) => set("diasAlertaVencimientoServicio", e.target.value)}
                    className="w-[90px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                  />
                  <span className="text-[12px] text-muted-2">días antes</span>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Aprobación sin respuesta</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={!esAdmin}
                    value={draft.diasAlertaAprobacion}
                    onChange={(e) => set("diasAlertaAprobacion", e.target.value)}
                    className="w-[90px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                  />
                  <span className="text-[12px] text-muted-2">días</span>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Onboarding estancado</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={!esAdmin}
                    value={draft.diasAlertaOnboarding}
                    onChange={(e) => set("diasAlertaOnboarding", e.target.value)}
                    className="w-[90px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                  />
                  <span className="text-[12px] text-muted-2">días en "solicitado"</span>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="mb-1 text-[13px] font-bold">Pacing de presupuesto</div>
            <p className="mb-3.5 text-[11.5px] text-muted-2">
              Umbral de desviación entre % gastado y % del mes transcurrido para alertar sobregasto o subgasto.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted-2">Umbral de desviación</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={!esAdmin}
                  value={draft.umbralPacingPct}
                  onChange={(e) => set("umbralPacingPct", e.target.value)}
                  className="w-[90px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink disabled:bg-hover-2 disabled:text-muted"
                />
                <span className="text-[12px] text-muted-2">% (± sobre el ritmo esperado)</span>
              </div>
            </label>
          </div>

          {esAdmin && (
            <div>
              <button
                onClick={guardar}
                disabled={pending}
                className="btn-primary rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Guardando…" : "Guardar ajustes"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
