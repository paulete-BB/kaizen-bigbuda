"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import type { BitacoraCompleta } from "@/lib/data/bitacora-completa";
import { fmtFecha } from "@/lib/dates";

const SYNC_LABEL: Record<string, { label: string; color: string }> = {
  ok: { label: "Sincronizado", color: "var(--color-success)" },
  pendiente_sync: { label: "Pendiente de sync", color: "var(--color-warning)" },
  error: { label: "Error de sync", color: "var(--color-danger)" },
};

export function BitacoraCompletaView({
  usuario,
  data,
  clientes,
}: {
  usuario: SidebarUsuario;
  data: BitacoraCompleta;
  clientes: { id: string; nombre: string }[];
}) {
  const [filtro, setFiltro] = useState<string>("Todo");
  const gruposFiltrados = data.grupos
    .map((g) => ({ ...g, items: filtro === "Todo" ? g.items : g.items.filter((i) => i.tipo === filtro) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href="/clientes" className="text-[13px] font-semibold text-muted-2">
            Clientes
          </Link>
          <span className="text-faint">/</span>
          <Link href={`/clientes/${data.clienteId}`} className="text-[13px] font-semibold text-muted-2">
            {data.clienteNombre}
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">Bitácora</span>
          <div className="flex-1" />
          <Link
            href={`/clientes/${data.clienteId}`}
            className="btn-primary flex items-center gap-2 rounded-[9px] bg-accent px-[15px] py-2.5 text-[13px] font-semibold text-white"
          >
            Volver a la ficha
          </Link>
        </header>

        <div className="flex w-full max-w-[1100px] flex-col gap-5 px-[26px] pb-10 pt-[22px]">
          <div>
            <h1 className="m-0 text-[22px] font-bold [letter-spacing:-0.4px]">Bitácora de {data.clienteNombre}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clientes.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}/bitacora`}
                  className="rounded-full border px-3 py-1 text-[12px] font-semibold"
                  style={{
                    borderColor: c.id === data.clienteId ? "var(--color-accent)" : "var(--color-border)",
                    background: c.id === data.clienteId ? "var(--color-accent-soft)" : "var(--color-surface)",
                    color: c.id === data.clienteId ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                  }}
                >
                  {c.nombre}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Registros totales", value: data.stats.total },
              { label: "Pendientes / atrasadas", value: data.stats.pendientes },
              { label: "Informes enviados", value: data.stats.informes },
              { label: "Última optimización", value: data.stats.ultima ?? "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-border bg-surface p-4">
                <div className="text-[20px] font-bold">{s.value}</div>
                <div className="text-[11.5px] text-muted-2">{s.label}</div>
              </div>
            ))}
          </div>

          {data.pendientes.length > 0 && (
            <div className="rounded-[14px] border border-danger-border bg-surface p-4">
              <div className="mb-2 text-[13px] font-bold text-danger">Por poner al día</div>
              <div className="flex flex-col gap-2">
                {data.pendientes.map((p, i) => (
                  <Link key={i} href={p.href} className="flex items-center justify-between rounded-lg bg-danger-bg px-3 py-2 text-[12.5px]">
                    <span className="font-semibold">{p.titulo}</span>
                    <span className="text-muted-2">
                      {p.detalle}
                      {p.responsable ? ` · ${p.responsable}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {["Todo", ...data.tipos].map((t) => (
              <button
                key={t}
                onClick={() => setFiltro(t)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold"
                style={{
                  borderColor: filtro === t ? "var(--color-accent)" : "var(--color-border)",
                  background: filtro === t ? "var(--color-accent-soft)" : "var(--color-surface)",
                  color: filtro === t ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5">
            {gruposFiltrados.length === 0 && (
              <p className="py-10 text-center text-[12.5px] text-muted-2">No hay entradas para este filtro.</p>
            )}
            {gruposFiltrados.map((g) => (
              <div key={g.mes}>
                <div className="mb-2 text-[11.5px] font-bold uppercase text-faint [letter-spacing:.03em]">{g.mes}</div>
                <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
                  {g.items.map((item, i) => {
                    const sync = SYNC_LABEL[item.syncStatus];
                    return (
                      <div key={item.id} className={`tl-item px-4 py-3 ${i === g.items.length - 1 ? "" : "border-b border-border-soft-2"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold">{item.titulo}</span>
                          <span className="text-[11px] text-muted">{fmtFecha(item.fecha)}</span>
                          <span className="rounded-full bg-accent-soft px-2 py-px text-[10.5px] font-semibold text-accent-soft-ink">{item.tipo}</span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted-2">{item.desc}</div>
                        <div className="mt-1.5 flex items-center gap-3">
                          {item.responsable && <span className="text-[11px] text-muted-2">{item.responsable}</span>}
                          <span className="text-[11px] font-semibold" style={{ color: sync.color }}>
                            {sync.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
