"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import type { ReunionDetalle } from "@/lib/data/meetings";
import { guardarNotasReunion } from "@/lib/data/meetings-actions";
import { fmtFecha } from "@/lib/dates";

const ESTADO_LABEL: Record<string, { label: string; fg: string; bg: string }> = {
  programada: { label: "Programada", fg: "var(--color-accent)", bg: "var(--color-accent-soft)" },
  realizada: { label: "Realizada", fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  cancelada: { label: "Cancelada", fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

export function ReunionView({ usuario, reunion }: { usuario: SidebarUsuario; reunion: ReunionDetalle }) {
  const router = useRouter();
  const [notas, setNotas] = useState(reunion.notas ?? "");
  const [realizada, setRealizada] = useState(reunion.estado === "realizada");
  const [pending, setPending] = useState(false);
  const estado = ESTADO_LABEL[reunion.estado] ?? ESTADO_LABEL.programada;

  async function guardar() {
    setPending(true);
    const fd = new FormData();
    fd.set("id", reunion.id);
    fd.set("clientId", reunion.clientId);
    fd.set("notas", notas);
    if (realizada) fd.set("marcarRealizada", "on");
    try {
      await guardarNotasReunion(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href={`/clientes/${reunion.clientId}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {reunion.clienteNombre}
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">Reunión</span>
          <span className="ml-auto rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ color: estado.fg, background: estado.bg }}>
            {estado.label}
          </span>
        </header>

        <div className="flex w-full max-w-[760px] flex-col gap-4 px-[26px] pb-10 pt-[22px]">
          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="text-[15px] font-bold">{reunion.titulo}</div>
            <div className="mt-1 text-[12.5px] text-muted-2">
              {fmtFecha(reunion.fecha)}
              {reunion.hora ? ` · ${reunion.hora.slice(0, 5)}` : ""} · {reunion.clienteNombre}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted-2">Puntos importantes conversados</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={8}
                placeholder="Ej. Cliente pide acelerar campaña de aniversario, revisar presupuesto extra para octubre…"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink"
              />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-ink">
              <input type="checkbox" checked={realizada} onChange={(e) => setRealizada(e.target.checked)} />
              Marcar como realizada
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pending}
              className="btn-primary rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar notas"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
