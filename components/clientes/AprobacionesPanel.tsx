"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalResumen, ApprovalEstado } from "@/lib/data/approvals";
import type { OptimizacionBloqueable } from "@/lib/data/approvals";
import { TIPOS_APROBACION, TIPO_APROBACION_LABEL } from "@/lib/approvals-tipos";
import { crearAprobacion, eliminarAprobacion, registrarRecordatorioAprobacion, resolverAprobacion } from "@/lib/data/approvals-actions";
import { fmtFecha } from "@/lib/dates";

const TIPO_OPTIMIZACION_LABEL: Record<string, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

const ESTADO_LABEL: Record<ApprovalEstado, string> = {
  enviado: "Enviado",
  sin_respuesta: "Sin respuesta",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const ESTADO_COLOR: Record<ApprovalEstado, { fg: string; bg: string }> = {
  enviado: { fg: "var(--color-muted)", bg: "var(--color-border-soft)" },
  sin_respuesta: { fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  aprobado: { fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  rechazado: { fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

interface AprobacionesPanelProps {
  clientId: string;
  aprobaciones: ApprovalResumen[];
  optimizacionesBloqueables: OptimizacionBloqueable[];
}

export function AprobacionesPanel({ clientId, aprobaciones, optimizacionesBloqueables }: AprobacionesPanelProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState({ tipo: "creativo", descripcion: "", link: "", canal: "", optimizationId: "" });
  const [bloquea, setBloquea] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNuevo() {
    if (!nuevo.descripcion.trim()) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("tipo", nuevo.tipo);
    fd.set("descripcion", nuevo.descripcion.trim());
    fd.set("link", nuevo.link.trim());
    fd.set("canal", nuevo.canal.trim());
    if (bloquea) fd.set("optimizationId", nuevo.optimizationId);
    try {
      const res = await crearAprobacion(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo registrar la aprobación.");
        return;
      }
      setAdding(false);
      setBloquea(false);
      setNuevo({ tipo: "creativo", descripcion: "", link: "", canal: "", optimizationId: "" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function resolver(a: ApprovalResumen, decision: "aprobado" | "rechazado") {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("clientId", clientId);
    fd.set("decision", decision);
    try {
      const res = await resolverAprobacion(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo resolver la aprobación.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function recordatorio(a: ApprovalResumen) {
    setPending(true);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("clientId", clientId);
    try {
      await registrarRecordatorioAprobacion(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function eliminar(a: ApprovalResumen) {
    if (!confirm(`¿Eliminar esta solicitud de aprobación? Esta acción no se puede deshacer.`)) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("clientId", clientId);
    try {
      const res = await eliminarAprobacion(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Aprobaciones</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="border-none bg-transparent font-sans text-[12px] font-semibold text-accent"
        >
          {adding ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {error && (
        <div className="border-b border-danger-border bg-danger-bg px-[18px] py-2 text-[12px] font-semibold text-danger">{error}</div>
      )}

      {adding && (
        <div className="flex flex-col gap-2.5 border-b border-border-soft bg-[#fdfbf7] px-[18px] py-[15px]">
          <div className="flex gap-2.5">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Tipo</span>
              <select
                value={nuevo.tipo}
                onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              >
                {TIPOS_APROBACION.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_APROBACION_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Canal (opcional)</span>
              <input
                value={nuevo.canal}
                onChange={(e) => setNuevo((n) => ({ ...n, canal: e.target.value }))}
                placeholder="Email, WhatsApp…"
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-muted-2">Descripción</span>
            <textarea
              value={nuevo.descripcion}
              onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
              rows={2}
              className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-muted-2">Link / adjunto (opcional)</span>
            <input
              value={nuevo.link}
              onChange={(e) => setNuevo((n) => ({ ...n, link: e.target.value }))}
              placeholder="https://…"
              className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
            />
          </label>
          {optimizacionesBloqueables.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-2">
                <input type="checkbox" checked={bloquea} onChange={(e) => setBloquea(e.target.checked)} />
                Bloquea una optimización pendiente
              </label>
              {bloquea && (
                <select
                  value={nuevo.optimizationId}
                  onChange={(e) => setNuevo((n) => ({ ...n, optimizationId: e.target.value }))}
                  className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
                >
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {optimizacionesBloqueables.map((o) => (
                    <option key={o.id} value={o.id}>
                      {TIPO_OPTIMIZACION_LABEL[o.tipo] ?? o.tipo} · {fmtFecha(o.fecha)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <button
            onClick={saveNuevo}
            disabled={pending}
            className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Registrar solicitud"}
          </button>
        </div>
      )}

      <div className="px-[18px] py-1.5 pb-3">
        {aprobaciones.length === 0 && <p className="py-6 text-center text-[12.5px] text-muted-2">Sin aprobaciones registradas.</p>}
        {aprobaciones.map((a) => {
          const pendienteResolver = a.estado === "enviado" || a.estado === "sin_respuesta";
          const color = ESTADO_COLOR[a.estado];
          return (
            <div key={a.id} className="border-b border-border-soft-2 py-[13px]">
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold">{TIPO_APROBACION_LABEL[a.tipo]}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: color.fg, background: color.bg }}>
                      {ESTADO_LABEL[a.estado]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink">{a.descripcion}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-2">
                    <span>Enviado {fmtFecha(a.enviadoEn)}</span>
                    {a.canal && <span>· {a.canal}</span>}
                    {a.resueltoEn && <span>· Resuelto {fmtFecha(a.resueltoEn)}</span>}
                    {a.recordatorios > 0 && <span>· {a.recordatorios} recordatorio{a.recordatorios > 1 ? "s" : ""}</span>}
                    {a.link && (
                      <a href={a.link} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                        · Ver adjunto
                      </a>
                    )}
                  </div>
                  {a.optimizacionId && (
                    <div className="mt-1 text-[11px] font-semibold text-warning">
                      Bloquea: {TIPO_OPTIMIZACION_LABEL[a.optimizacionTipo ?? ""] ?? a.optimizacionTipo}
                      {a.optimizacionFecha ? ` · ${fmtFecha(a.optimizacionFecha)}` : ""}
                    </div>
                  )}
                </div>
              </div>

              {pendienteResolver && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => resolver(a, "aprobado")}
                    disabled={pending}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 font-sans text-[11.5px] font-semibold text-success disabled:opacity-60"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => resolver(a, "rechazado")}
                    disabled={pending}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 font-sans text-[11.5px] font-semibold text-danger disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => recordatorio(a)}
                    disabled={pending}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 font-sans text-[11.5px] font-semibold text-muted disabled:opacity-60"
                  >
                    Recordatorio enviado
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => eliminar(a)}
                    disabled={pending}
                    title="Eliminar del registro"
                    className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-danger-border bg-surface text-danger disabled:opacity-60"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
