"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { RANGOS_RESULTADOS, type RangoResultados } from "@/lib/resultados-rango";
import type { ClienteSelectorResultados } from "@/lib/data/resultados";

export function SelectorResultados({
  clientes,
  clienteId,
  rango,
}: {
  clientes: ClienteSelectorResultados[];
  clienteId: string;
  rango: RangoResultados;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <select
        value={clienteId}
        onChange={(e) => router.push(`/resultados?clienteId=${e.target.value}&rango=${rango}`)}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-[13px] font-semibold text-ink"
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-lg bg-border-soft-2 p-1">
        {RANGOS_RESULTADOS.map((r) => (
          <Link
            key={r}
            href={`/resultados?clienteId=${clienteId}&rango=${r}`}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
            style={{
              background: r === rango ? "var(--color-surface)" : "transparent",
              color: r === rango ? "var(--color-accent)" : "var(--color-muted)",
              boxShadow: r === rango ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
            }}
          >
            {r}d
          </Link>
        ))}
      </div>
    </div>
  );
}
