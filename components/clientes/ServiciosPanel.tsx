"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ServicioDetalle, ServicioTipo } from "@/lib/data/cliente-detalle";
import { actualizarVigenciaServicio, agregarServicio, pausarServicio, reactivarServicio } from "@/lib/data/cliente-actions";
import { addMeses, diasHasta, fmtFecha, hoySantiago, parseIso } from "@/lib/dates";
import type { UsuarioResumen } from "@/lib/data/users";

const MOTIVOS = [
  "Renovación acordada",
  "Extensión comercial",
  "Pausa del cliente",
  "Corrección de fecha",
];

const TIPOS: { tipo: ServicioTipo; label: string; ads: boolean }[] = [
  { tipo: "seo_aeo_geo", label: "SEO · AEO · GEO", ads: false },
  { tipo: "meta_ads", label: "Meta Ads", ads: true },
  { tipo: "google_ads", label: "Google Ads", ads: true },
];

interface ServiciosPanelProps {
  clientId: string;
  servicios: ServicioDetalle[];
  serviciosTiposExistentes: ServicioTipo[];
  responsables: UsuarioResumen[];
  diasAvisoVencimiento?: number;
}

export function ServiciosPanel({
  clientId,
  servicios,
  serviciosTiposExistentes,
  responsables,
  diasAvisoVencimiento = 45,
}: ServiciosPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ fecha: "", motivo: MOTIVOS[0] });
  const [pending, setPending] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const hoy = hoySantiago();

  const [adding, setAdding] = useState(false);
  const disponibles = TIPOS.filter((t) => !serviciosTiposExistentes.includes(t.tipo));
  const [nuevo, setNuevo] = useState({
    tipo: disponibles[0]?.tipo ?? "seo_aeo_geo",
    fechaInicio: hoySantiago().toISOString().slice(0, 10),
    periodoMeses: "",
    presupuesto: "",
    moneda: "CLP",
    responsableId: "",
  });
  const [nuevoError, setNuevoError] = useState<string | null>(null);

  function startEdit(s: ServicioDetalle) {
    setEditingId(s.id);
    setDraft({ fecha: s.vigencia ?? "", motivo: MOTIVOS[0] });
  }

  async function save(s: ServicioDetalle) {
    setPending(true);
    const fd = new FormData();
    fd.set("serviceId", s.id);
    fd.set("clientId", clientId);
    fd.set("nuevaFecha", draft.fecha);
    fd.set("motivo", draft.motivo);
    fd.set("nombreServicio", s.nombre);
    try {
      await actualizarVigenciaServicio(fd);
      setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function togglePausa(s: ServicioDetalle) {
    setPendingServiceId(s.id);
    const fd = new FormData();
    fd.set("serviceId", s.id);
    fd.set("clientId", clientId);
    fd.set("nombreServicio", s.nombre);
    try {
      await (s.pausado ? reactivarServicio(fd) : pausarServicio(fd));
      router.refresh();
    } finally {
      setPendingServiceId(null);
    }
  }

  async function guardarNuevo() {
    setNuevoError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("tipo", nuevo.tipo);
    fd.set("fechaInicio", nuevo.fechaInicio);
    if (nuevo.periodoMeses) fd.set("periodoMeses", nuevo.periodoMeses);
    if (nuevo.responsableId) fd.set("responsableId", nuevo.responsableId);
    if (nuevo.presupuesto) fd.set("presupuesto", nuevo.presupuesto);
    fd.set("moneda", nuevo.moneda);
    try {
      const res = await agregarServicio(fd);
      if (!res.ok) {
        setNuevoError(res.error ?? "No se pudo agregar el servicio.");
        return;
      }
      setAdding(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const nuevoEsAds = TIPOS.find((t) => t.tipo === nuevo.tipo)?.ads ?? false;

  return (
    <div>
      <div className="mb-[11px] flex items-baseline justify-between">
        <div className="text-[12px] font-bold uppercase text-faint [letter-spacing:.04em]">
          Servicios
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11.5px] text-muted-2">Caducidades editables · los cambios quedan en la bitácora</div>
          {disponibles.length > 0 && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="border-none bg-transparent font-sans text-[12px] font-semibold text-accent"
            >
              {adding ? "Cancelar" : "+ Agregar servicio"}
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mb-4 flex flex-col gap-2.5 rounded-[14px] border border-border bg-[#fdfbf7] p-[15px]">
          {nuevoError && (
            <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{nuevoError}</div>
          )}
          <div className="flex flex-wrap gap-2.5">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Servicio</span>
              <select
                value={nuevo.tipo}
                onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value as ServicioTipo }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              >
                {disponibles.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Fecha de inicio</span>
              <input
                type="date"
                value={nuevo.fechaInicio}
                onChange={(e) => setNuevo((n) => ({ ...n, fechaInicio: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              />
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Período contratado</span>
              <select
                value={nuevo.periodoMeses}
                onChange={(e) => setNuevo((n) => ({ ...n, periodoMeses: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              >
                <option value="">Indefinido</option>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {nuevoEsAds && (
              <>
                <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-2">Presupuesto mensual</span>
                  <input
                    type="number"
                    min={0}
                    value={nuevo.presupuesto}
                    onChange={(e) => setNuevo((n) => ({ ...n, presupuesto: e.target.value }))}
                    className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
                  />
                </label>
                <label className="flex w-[90px] flex-none flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-2">Moneda</span>
                  <select
                    value={nuevo.moneda}
                    onChange={(e) => setNuevo((n) => ({ ...n, moneda: e.target.value }))}
                    className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </>
            )}
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-2">Responsable</span>
              <select
                value={nuevo.responsableId}
                onChange={(e) => setNuevo((n) => ({ ...n, responsableId: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
              >
                <option value="">Sin asignar</option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button
              onClick={guardarNuevo}
              disabled={pending}
              className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Agregando…" : "Agregar servicio"}
            </button>
          </div>
        </div>
      )}

      <div className="svc-grid grid grid-cols-2 gap-4">
        {servicios.map((s) => {
          const dias = s.vigencia ? diasHasta(s.vigencia, hoy) : null;
          const total = s.vigencia ? diasHasta(s.vigencia, parseIso(s.inicio)) : null;
          const restPct = dias != null && total ? Math.max(4, Math.min(100, Math.round((dias / total) * 100))) : 0;
          const vencido = dias != null && dias < 0;
          const fg = vencido
            ? "var(--color-danger)"
            : dias != null && dias <= diasAvisoVencimiento
              ? "var(--color-warning)"
              : "var(--color-success)";
          const estadoLabel = s.pausado ? "Pausado" : vencido ? "Vencido" : s.ritmo ? "Ritmo alto" : "Activo";
          const estadoFg = s.pausado ? "var(--color-muted-2)" : vencido ? "var(--color-danger)" : s.ritmo ? "var(--color-warning)" : "var(--color-success)";
          const estadoBg = s.pausado ? "var(--color-border-soft)" : vencido ? "var(--color-danger-bg)" : s.ritmo ? "var(--color-warning-bg)" : "var(--color-success-bg)";
          const editing = editingId === s.id;

          const metas: { label: string; value: string; color?: string }[] = [
            { label: "Inicio", value: fmtFecha(s.inicio) },
          ];
          if (s.periodo) metas.push({ label: "Período", value: s.periodo });
          if (s.presupuesto) metas.push({ label: "Presupuesto", value: s.presupuesto });
          if (s.viernesOrdinal) metas.push({ label: "Viernes", value: s.viernesOrdinal, color: s.color });

          return (
            <div
              key={s.id}
              className="flex flex-col rounded-[14px] border border-border bg-surface p-[18px]"
              style={{ borderTop: `3px solid ${s.color}`, opacity: s.pausado ? 0.65 : 1 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                  <span className="text-[14px] font-bold">{s.nombre}</span>
                </div>
                <span
                  className="rounded-full px-[9px] py-0.5 text-[11px] font-semibold"
                  style={{ color: estadoFg, background: estadoBg }}
                >
                  {estadoLabel}
                </span>
              </div>

              <div className="mt-4 flex gap-5 text-[12px]">
                {metas.map((m) => (
                  <div key={m.label}>
                    <div className="mb-0.5 text-muted-2">{m.label}</div>
                    <div className="font-semibold" style={{ color: m.color }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {s.ritmo && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-2">Ritmo de gasto · vs. mes</span>
                    <span className="font-bold text-danger">{s.ritmoLabel}</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-md bg-border-soft">
                    <div
                      className="h-full rounded-md bg-danger"
                      style={{ width: `${Math.min(100, s.pacingPct ?? 0)}%` }}
                    />
                  </div>
                  {s.gastoAcumulado != null && s.presupuestoMensual != null && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                      <span className="font-semibold text-danger">
                        Gastado ${Number(s.gastoAcumulado).toLocaleString("es-CL")} ({s.pacingPct}%)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {s.vigencia && dias != null ? (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-2">Vigencia hasta {fmtFecha(s.vigencia)}</span>
                    <span className="font-bold" style={{ color: fg }}>
                      {vencido ? `${Math.abs(dias)} días vencido` : `${dias} días`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-md bg-border-soft">
                    <div className="h-full rounded-md" style={{ width: `${restPct}%`, background: fg }} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-[11.5px] text-muted-2">Vigencia indefinida.</div>
              )}

              {editing ? (
                <div className="mt-[15px] flex flex-col gap-[11px] border-t border-dashed border-border pt-3.5">
                  <div className="text-[11.5px] font-bold uppercase text-faint [letter-spacing:.03em]">
                    Modificar caducidad
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[3, 6, 12].map((n) => (
                      <button
                        key={n}
                        className="preset rounded-lg border border-border bg-surface px-[11px] py-1.5 font-sans text-[12px] font-semibold text-ink"
                        onClick={() => setDraft((d) => ({ ...d, fecha: addMeses(s.vigencia ?? s.inicio, n) }))}
                      >
                        +{n} meses
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <label className="flex min-w-[150px] flex-1 flex-col gap-1.5">
                      <span className="text-[11.5px] font-semibold text-muted-2">Nueva fecha de término</span>
                      <input
                        type="date"
                        value={draft.fecha}
                        onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
                        className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
                      />
                    </label>
                    <label className="flex min-w-[150px] flex-1 flex-col gap-1.5">
                      <span className="text-[11.5px] font-semibold text-muted-2">Motivo</span>
                      <select
                        value={draft.motivo}
                        onChange={(e) => setDraft((d) => ({ ...d, motivo: e.target.value }))}
                        className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
                      >
                        {MOTIVOS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save(s)}
                      disabled={pending}
                      className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
                    >
                      {pending ? "Guardando…" : "Guardar caducidad"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="ghost rounded-lg border border-border bg-surface px-3.5 py-2 font-sans text-[12.5px] font-semibold text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3.5 flex gap-2">
                  {!s.pausado && (
                    <button
                      onClick={() => startEdit(s)}
                      className="ghost flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[12px] font-semibold text-ink"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
                        <rect x="3" y="4.5" width="18" height="16" rx="2" />
                        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
                      </svg>
                      Editar caducidad
                    </button>
                  )}
                  <button
                    onClick={() => togglePausa(s)}
                    disabled={pendingServiceId === s.id}
                    className="ghost flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[12px] font-semibold text-muted disabled:opacity-60"
                  >
                    {s.pausado ? "Reactivar servicio" : "Pausar servicio"}
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
