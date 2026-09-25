"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OffboardingResumen } from "@/lib/data/offboarding";
import { eliminarDatosContactoCliente, marcarRetencionDatos, toggleOffboardingItem } from "@/lib/data/offboarding-actions";
import { fmtFecha } from "@/lib/dates";

export function OffboardingPanel({
  clientId,
  resumen,
  datosRetenidosNota,
  contactoAnonimizadoEn,
}: {
  clientId: string;
  resumen: OffboardingResumen;
  datosRetenidosNota: string | null;
  contactoAnonimizadoEn: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [nota, setNota] = useState(datosRetenidosNota ?? "");
  const [pendingNota, setPendingNota] = useState(false);
  const [pendingEliminar, setPendingEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { porcentaje, totalItems, completados, items } = resumen;

  async function toggle(itemId: string) {
    setPendingId(itemId);
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("clientId", clientId);
    try {
      await toggleOffboardingItem(fd);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function guardarNota() {
    setPendingNota(true);
    setError(null);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("nota", nota);
    try {
      const res = await marcarRetencionDatos(fd);
      if (!res.ok) setError(res.error ?? "No se pudo guardar la nota.");
      else router.refresh();
    } finally {
      setPendingNota(false);
    }
  }

  async function eliminarDatos() {
    if (!confirm("¿Eliminar los datos personales del contacto (nombre, email, teléfono)? Esta acción no se puede deshacer. El historial de trabajo del cliente se conserva.")) return;
    setPendingEliminar(true);
    setError(null);
    const fd = new FormData();
    fd.set("clientId", clientId);
    try {
      const res = await eliminarDatosContactoCliente(fd);
      if (!res.ok) setError(res.error ?? "No se pudo eliminar los datos del contacto.");
      else router.refresh();
    } finally {
      setPendingEliminar(false);
    }
  }

  const dash = `${porcentaje} ${100 - porcentaje}`;
  const faltan = totalItems - completados;

  return (
    <div className="overflow-hidden rounded-[14px] border border-danger-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Cierre del cliente</span>
        <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-semibold text-danger">
          {porcentaje}% completado
        </span>
      </div>

      {error && (
        <div className="border-b border-danger-border bg-danger-bg px-[18px] py-2 text-[12px] font-semibold text-danger">{error}</div>
      )}

      <div className="px-[18px] py-4">
        {totalItems === 0 ? (
          <p className="py-2 text-[12.5px] text-muted-2">Sin checklist de cierre todavía.</p>
        ) : (
          <>
            <div className="mb-3.5 flex items-center gap-3.5">
              <div className="relative h-[58px] w-[58px] flex-none">
                <svg width="58" height="58" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border-soft)" strokeWidth="5" />
                  <g transform="rotate(-90 21 21)">
                    <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-danger)" strokeWidth="5" strokeDasharray={dash} />
                  </g>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold">{porcentaje}%</div>
              </div>
              <div className="text-[12px] leading-[1.45] text-muted">
                {completados} de {totalItems} ítems completados. {faltan > 0 ? `Faltan ${faltan} por cerrar.` : "Cierre listo."}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const done = item.estado === "completado";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    disabled={pendingId === item.id}
                    className="flex items-center gap-2 text-left text-[12.5px] disabled:opacity-60"
                  >
                    {done ? (
                      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-danger">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M5 12l4 4 10-11" />
                        </svg>
                      </span>
                    ) : (
                      <span className="h-[18px] w-[18px] flex-none rounded-[5px] border-[1.8px] border-border" />
                    )}
                    <span className="flex-1 text-muted">
                      {item.descripcion}
                      {item.bloqueante && <span className="ml-1 text-danger">*</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-border-soft pt-3.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Retención de datos</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Qué se conserva (historial de trabajo, informes) y qué se elimina a solicitud."
            rows={2}
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
          />
          <button
            onClick={guardarNota}
            disabled={pendingNota}
            className="self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-60"
          >
            {pendingNota ? "Guardando…" : "Guardar nota"}
          </button>
        </div>

        <div className="mt-3.5 flex flex-col gap-2 border-t border-border-soft pt-3.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Datos personales del contacto (Ley 21.719)</span>
          {contactoAnonimizadoEn ? (
            <p className="text-[12px] text-muted-2">Eliminados el {fmtFecha(contactoAnonimizadoEn.slice(0, 10))}.</p>
          ) : (
            <button
              onClick={eliminarDatos}
              disabled={pendingEliminar}
              className="self-start rounded-lg border border-danger-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-danger disabled:opacity-60"
            >
              {pendingEliminar ? "Eliminando…" : "Eliminar datos del contacto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
