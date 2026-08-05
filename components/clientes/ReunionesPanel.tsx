"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Reunion } from "@/lib/data/meetings";
import { agendarReunion } from "@/lib/data/meetings-actions";
import { fmtFecha } from "@/lib/dates";

const ESTADO_DOT: Record<string, string> = {
  programada: "var(--color-accent)",
  realizada: "var(--color-success)",
  cancelada: "var(--color-faint)",
};

export function ReunionesPanel({ clientId, reuniones }: { clientId: string; reuniones: Reunion[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [pending, setPending] = useState(false);

  const proximas = reuniones.filter((r) => r.estado === "programada").length;
  const ordenadas = [...reuniones].sort((a, b) => (a.estado === "programada") === (b.estado === "programada") ? a.fecha.localeCompare(b.fecha) : a.estado === "programada" ? -1 : 1);

  async function agendar() {
    if (!titulo.trim() || !fecha) return;
    setPending(true);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("titulo", titulo.trim());
    fd.set("fecha", fecha);
    fd.set("hora", hora);
    try {
      await agendarReunion(fd);
      setTitulo("");
      setFecha("");
      setHora("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Reuniones</span>
        <span className="text-[11.5px] text-muted-2">{proximas} próximas</span>
      </div>

      <div className="flex flex-col gap-2 border-b border-border-soft px-[18px] py-3.5">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej. Kickoff de campaña de aniversario"
          className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
          />
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-[105px] rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-ink"
          />
          <button
            onClick={agendar}
            disabled={pending}
            className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 font-sans text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Agendar"}
          </button>
        </div>
      </div>

      <div className="px-[18px] py-2">
        {ordenadas.length === 0 && <p className="py-4 text-center text-[12px] text-muted-2">Sin reuniones agendadas.</p>}
        {ordenadas.map((r) => (
          <Link
            key={r.id}
            href={`/reuniones/${r.id}`}
            className="flex items-center gap-2.5 border-b border-border-soft-2 py-2.5 last:border-b-0"
          >
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: ESTADO_DOT[r.estado] }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-ink">{r.titulo}</div>
              <div className="text-[11px] text-muted-2">
                {fmtFecha(r.fecha)}
                {r.hora ? ` · ${r.hora.slice(0, 5)}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
