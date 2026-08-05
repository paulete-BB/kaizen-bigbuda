"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OnboardingResumen } from "@/lib/data/onboarding";
import { toggleOnboardingItem } from "@/lib/data/onboarding-actions";

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  recibido: { label: "Recibido", color: "var(--color-success)" },
  completado: { label: "Recibido", color: "var(--color-success)" },
  solicitado: { label: "Solicitado", color: "var(--color-warning)" },
  pendiente: { label: "Pendiente", color: "var(--color-faint)" },
};

export function OnboardingPanel({ clientId, resumen }: { clientId: string; resumen: OnboardingResumen }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { porcentaje, totalItems, completados, items } = resumen;

  async function toggle(itemId: string) {
    setPendingId(itemId);
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("clientId", clientId);
    try {
      await toggleOnboardingItem(fd);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }
  const dash = `${porcentaje} ${100 - porcentaje}`;
  const faltan = totalItems - completados;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Onboarding</span>
        <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success">
          {porcentaje}% completado
        </span>
      </div>
      <div className="px-[18px] py-4">
        <div className="mb-3.5 flex items-center gap-3.5">
          <div className="relative h-[58px] w-[58px] flex-none">
            <svg width="58" height="58" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border-soft)" strokeWidth="5" />
              <g transform="rotate(-90 21 21)">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke="var(--color-success)"
                  strokeWidth="5"
                  strokeDasharray={dash}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold">
              {porcentaje}%
            </div>
          </div>
          <div className="text-[12px] leading-[1.45] text-muted">
            {completados} de {totalItems} ítems completados. {faltan > 0 ? `Faltan ${faltan} por confirmar.` : "Todo listo."}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const estado = ESTADO_LABEL[item.estado] ?? ESTADO_LABEL.pendiente;
            const done = item.estado === "recibido" || item.estado === "completado";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                disabled={pendingId === item.id}
                className="flex items-center gap-2 text-left text-[12.5px] disabled:opacity-60"
              >
                {done ? (
                  <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-success">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 12l4 4 10-11" />
                    </svg>
                  </span>
                ) : (
                  <span
                    className="h-[18px] w-[18px] flex-none rounded-[5px] border-[1.8px]"
                    style={{
                      borderColor: item.estado === "solicitado" ? "var(--color-warning-border)" : "var(--color-border)",
                      background: item.estado === "solicitado" ? "var(--color-warning-soft-bg)" : "transparent",
                    }}
                  />
                )}
                <span className="flex-1 text-muted">
                  {item.descripcion}
                  {item.bloqueante && <span className="ml-1 text-danger">*</span>}
                </span>
                <span className="text-[10.5px] font-semibold" style={{ color: estado.color }}>
                  {estado.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
