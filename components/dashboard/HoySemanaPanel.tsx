"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventoResumen } from "@/lib/data/dashboard";
import { fmtFecha } from "@/lib/dates";

const ESTADO_LABEL: Record<string, { label: string; fg: string; bg: string }> = {
  programada: { label: "Programada", fg: "var(--color-muted)", bg: "var(--color-border-soft)" },
  realizada: { label: "Realizada", fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  atrasada: { label: "Atrasada", fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  bloqueada: { label: "Bloqueada", fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  cancelada: { label: "Cancelada", fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

export function HoySemanaPanel({ hoy, semana }: { hoy: EventoResumen[]; semana: EventoResumen[] }) {
  const [tab, setTab] = useState<"hoy" | "semana">("hoy");
  const eventos = tab === "hoy" ? hoy : semana;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
        <div className="flex overflow-hidden rounded-[9px] border border-border">
          <button
            onClick={() => setTab("hoy")}
            className="px-3.5 py-2 font-sans text-[12.5px] font-semibold"
            style={{
              background: tab === "hoy" ? "var(--color-accent-soft)" : "var(--color-surface)",
              color: tab === "hoy" ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
            }}
          >
            Hoy {hoy.length > 0 && `· ${hoy.length}`}
          </button>
          <button
            onClick={() => setTab("semana")}
            className="border-l border-border px-3.5 py-2 font-sans text-[12.5px] font-semibold"
            style={{
              background: tab === "semana" ? "var(--color-accent-soft)" : "var(--color-surface)",
              color: tab === "semana" ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
            }}
          >
            Esta semana {semana.length > 0 && `· ${semana.length}`}
          </button>
        </div>
        <Link href="/calendario" className="text-[12.5px] font-semibold">
          Ver calendario
        </Link>
      </div>

      <div className="px-5 py-1.5">
        {eventos.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-muted-2">
            No hay optimizaciones {tab === "hoy" ? "programadas para hoy" : "en el resto de la semana"}.
          </p>
        )}
        {eventos.map((e) => {
          const estado = ESTADO_LABEL[e.estado] ?? ESTADO_LABEL.programada;
          return (
            <Link
              key={e.id}
              href={`/clientes/${e.clienteId}`}
              className="tl-item flex items-center gap-3 border-b border-border-soft-2 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{e.clienteNombre}</span>
                  <span className="text-[11px] text-muted-2">{e.tipo}</span>
                  {e.informeEnviado && (
                    <span className="rounded-full bg-success-bg px-2 py-px text-[10.5px] font-semibold text-success">
                      Informe enviado
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-2">
                  {fmtFecha(e.fecha)}
                  {e.hora ? ` · ${e.hora.slice(0, 5)}` : ""}
                  {e.responsable ? ` · ${e.responsable}` : ""}
                </div>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: estado.fg, background: estado.bg }}>
                {estado.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
