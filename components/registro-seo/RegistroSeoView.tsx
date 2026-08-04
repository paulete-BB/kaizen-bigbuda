"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import type { RegistroSeoDetalle } from "@/lib/data/registro-seo";
import { guardarRegistroSeo, toggleChecklistItemSeo } from "@/lib/data/registro-seo-actions";
import { fmtFecha } from "@/lib/dates";

export function RegistroSeoView({
  usuario,
  registro,
}: {
  usuario: SidebarUsuario;
  registro: RegistroSeoDetalle;
}) {
  const router = useRouter();
  const [resumen, setResumen] = useState(registro.resumen ?? "");
  const [hallazgos, setHallazgos] = useState(registro.hallazgos ?? "");
  const [proximosPasos, setProximosPasos] = useState(registro.proximosPasos ?? "");
  const [proximaFecha, setProximaFecha] = useState(registro.proximaFechaPropuesta);
  const [informeEnviado, setInformeEnviado] = useState(!!registro.informeEnviadoEn);
  const [fechaInforme, setFechaInforme] = useState(registro.informeEnviadoEn ?? registro.fechaProgramada);
  const [simulandoError, setSimulandoError] = useState(false);
  const [pending, setPending] = useState(false);
  const ckDone = registro.checklist.filter((c) => c.completado).length;

  async function toggleItem(itemId: string) {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("optimizationId", registro.optimizationId);
    await toggleChecklistItemSeo(fd);
    router.refresh();
  }

  async function guardar() {
    setPending(true);
    const fd = new FormData();
    fd.set("optimizationId", registro.optimizationId);
    fd.set("serviceId", registro.serviceId);
    fd.set("clientId", registro.clientId);
    fd.set("clienteNombre", registro.clienteNombre);
    fd.set("resumen", resumen);
    fd.set("hallazgos", hallazgos);
    fd.set("proximosPasos", proximosPasos);
    fd.set("proximaFecha", proximaFecha);
    if (informeEnviado) fd.set("informeEnviado", "on");
    fd.set("fechaInforme", fechaInforme);
    if (registro.responsableId) fd.set("responsableId", registro.responsableId);
    try {
      await guardarRegistroSeo(fd);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="calendario" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href="/calendario" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Calendario
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">Registrar optimización SEO</span>
          <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent-soft-ink">
            SEO · AEO · GEO
          </span>
        </header>

        <div className="grid w-full max-w-[1200px] gap-5 px-[26px] pb-10 pt-[22px]" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white">
                  {registro.clienteIniciales}
                </div>
                <div>
                  <div className="text-[15px] font-bold">{registro.clienteNombre}</div>
                  <div className="text-[12px] text-muted-2">
                    Viernes {fmtFecha(registro.fechaProgramada)} · Responsable: {registro.responsable ?? "Sin asignar"}
                  </div>
                </div>
                {registro.estado === "realizada" && (
                  <span className="ml-auto rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-success">
                    Ya registrada
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">Checklist SEO · AEO · GEO</span>
                <span className="text-[12px] font-semibold text-muted-2">
                  {ckDone}/{registro.checklist.length}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {registro.checklist.map((c) => (
                  <button key={c.id} onClick={() => toggleItem(c.id)} className="flex items-center gap-2 text-left text-[12.5px]">
                    <span
                      className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[4px] border-[1.6px]"
                      style={{ borderColor: c.completado ? "var(--color-success)" : "var(--color-border)", background: c.completado ? "var(--color-success)" : "transparent" }}
                    >
                      {c.completado && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
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
            </div>

            <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Resumen de lo realizado</span>
                <textarea value={resumen} onChange={(e) => setResumen(e.target.value)} rows={3} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Hallazgos (opcional)</span>
                <textarea value={hallazgos} onChange={(e) => setHallazgos(e.target.value)} rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Próximos pasos</span>
                <textarea value={proximosPasos} onChange={(e) => setProximosPasos(e.target.value)} rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">
                    Próxima optimización propuesta <span className="text-accent">AUTO</span>
                  </span>
                  <input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
              </div>
              <p className="text-[11px] text-muted-2">Calculada al mismo viernes ordinal del mes siguiente; editable si se necesita ajustar.</p>

              <label className="flex items-center gap-2 text-[12.5px] text-ink">
                <input type="checkbox" checked={informeEnviado} onChange={(e) => setInformeEnviado(e.target.checked)} />
                Informe enviado
              </label>
              {informeEnviado && (
                <input type="date" value={fechaInforme} onChange={(e) => setFechaInforme(e.target.value)} className="w-[180px] rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-border bg-[#0d0d0d] p-5 text-[12px] text-[#e8e8e8]" style={{ fontFamily: "ui-monospace, monospace" }}>
              <div className="mb-2 text-[11px] font-bold uppercase text-[#e8b06e] [letter-spacing:.05em]">Vista previa · ClickUp Doc</div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {`## [${new Date().toISOString().slice(0, 10)}] Optimización SEO · AEO · GEO\n**Responsable:** ${registro.responsable ?? "—"}\n**Realizado:** ${resumen || "…"}\n${hallazgos ? `**Hallazgos:** ${hallazgos}\n` : ""}**Próxima optimización:** ${proximaFecha || "…"}\n**Informe:** ${informeEnviado ? `enviado el ${fechaInforme}` : "pendiente"}`}
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: simulandoError ? "var(--color-danger)" : "var(--color-warning)" }}>
                {simulandoError ? "Error de sincronización" : "Se sincronizará como pendiente_sync"}
              </div>
              <p className="mt-1 text-[11px] text-muted-2">
                ClickUp real todavía no está conectado (Fase 2) — queda en la bitácora interna y se reintenta cuando exista el job.
              </p>
              <button onClick={() => setSimulandoError((v) => !v)} className="mt-2 text-[11px] font-semibold text-muted-2 underline">
                {simulandoError ? "Restablecer" : "Simular error de sync"}
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={guardar} disabled={pending} className="btn-primary flex-1 rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white disabled:opacity-60">
                {pending ? "Guardando…" : "Cerrar y enviar a bitácora"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
