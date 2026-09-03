"use client";

import { useState } from "react";
import { hoySantiago, mesLargo } from "@/lib/dates";
import type { ClienteParaVariables } from "@/lib/data/prompts";

function resolverVariables(contenido: string, cliente: ClienteParaVariables | null): string {
  const mes = mesLargo(hoySantiago().getMonth() + 1);
  return contenido
    .replaceAll("{{cliente}}", cliente?.nombre ?? "{{cliente}}")
    .replaceAll("{{url}}", cliente?.sitioWeb ?? "{{url}}")
    .replaceAll("{{mes}}", mes);
}

export function CopiarConVariables({ contenido, clientes }: { contenido: string; clientes: ClienteParaVariables[] }) {
  const [clienteId, setClienteId] = useState("");
  const [copiado, setCopiado] = useState<"resuelto" | "crudo" | null>(null);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  async function copiar(tipo: "resuelto" | "crudo") {
    const texto = tipo === "resuelto" ? resolverVariables(contenido, cliente) : contenido;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // portapapeles no disponible (permiso denegado, http sin TLS, etc.) — no hay mucho más que hacer acá
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <div className="text-[13px] font-bold">Copiar con variables resueltas</div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Cliente (para {"{{cliente}}"} / {"{{url}}"})</span>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink">
          <option value="">Sin resolver — dejar variables tal cual</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2.5">
        <button onClick={() => copiar("resuelto")} className="btn-primary rounded-lg border-none bg-accent px-3.5 py-2 text-[12px] font-semibold text-white">
          Copiar con variables resueltas
        </button>
        <button onClick={() => copiar("crudo")} className="ghost rounded-lg border border-border bg-surface px-3.5 py-2 text-[12px] font-semibold text-muted">
          Copiar tal cual
        </button>
        {copiado && <span className="text-[11.5px] font-semibold text-success">Copiado al portapapeles.</span>}
      </div>
    </div>
  );
}
