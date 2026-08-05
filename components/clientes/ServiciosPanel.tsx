"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ServicioDetalle } from "@/lib/data/cliente-detalle";
import { actualizarVigenciaServicio } from "@/lib/data/cliente-actions";
import { addMeses, diasHasta, fmtFecha, hoySantiago, parseIso } from "@/lib/dates";

const MOTIVOS = [
  "Renovación acordada",
  "Extensión comercial",
  "Pausa del cliente",
  "Corrección de fecha",
];

interface ServiciosPanelProps {
  clientId: string;
  servicios: ServicioDetalle[];
  diasAvisoVencimiento?: number;
}

export function ServiciosPanel({ clientId, servicios, diasAvisoVencimiento = 45 }: ServiciosPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ fecha: "", motivo: MOTIVOS[0] });
  const [pending, setPending] = useState(false);
  const hoy = hoySantiago();

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

  return (
    <div>
      <div className="mb-[11px] flex items-baseline justify-between">
        <div className="text-[12px] font-bold uppercase text-faint [letter-spacing:.04em]">
          Servicios activos
        </div>
        <div className="text-[11.5px] text-muted-2">
          Caducidades editables · los cambios quedan en la bitácora
        </div>
      </div>

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
          const estadoLabel = vencido ? "Vencido" : s.ritmo ? "Ritmo alto" : "Activo";
          const estadoFg = vencido ? "var(--color-danger)" : s.ritmo ? "var(--color-warning)" : "var(--color-success)";
          const estadoBg = vencido ? "var(--color-danger-bg)" : s.ritmo ? "var(--color-warning-bg)" : "var(--color-success-bg)";
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
              style={{ borderTop: `3px solid ${s.color}` }}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
