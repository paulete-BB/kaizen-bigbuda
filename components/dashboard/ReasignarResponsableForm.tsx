"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UsuarioResumen } from "@/lib/data/users";
import { reasignarResponsableOptimizacion } from "@/lib/data/optimizaciones-actions";

export function ReasignarResponsableForm({
  optimizationId,
  responsableActualId,
  responsables,
}: {
  optimizationId: string;
  responsableActualId: string;
  responsables: UsuarioResumen[];
}) {
  const router = useRouter();
  const [responsableId, setResponsableId] = useState(
    responsables.find((r) => r.id !== responsableActualId)?.id ?? responsableActualId,
  );
  const [pending, setPending] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function reasignar() {
    setPending(true);
    const fd = new FormData();
    fd.set("optimizationId", optimizationId);
    fd.set("responsableId", responsableId);
    try {
      const res = await reasignarResponsableOptimizacion(fd);
      if (res.ok) {
        setHecho(true);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (hecho) return <span className="text-[10.5px] font-semibold text-success">Reasignado</span>;

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
      <select
        value={responsableId}
        onChange={(e) => setResponsableId(e.target.value)}
        className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10.5px] text-ink"
      >
        {responsables.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>
      <button
        onClick={reasignar}
        disabled={pending}
        className="rounded-md border-none bg-accent px-2 py-0.5 font-sans text-[10.5px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Reasignar"}
      </button>
    </div>
  );
}
