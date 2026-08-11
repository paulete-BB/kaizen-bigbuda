"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importarConfigDashboard } from "@/lib/data/integraciones-actions";

export function ImportadorConfigDashboard() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ emparejados: string[]; sinEmparejar: string[] } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJson(String(ev.target?.result ?? ""));
    reader.readAsText(file);
  }

  async function importar() {
    setPending(true);
    setError(null);
    setResultado(null);
    const fd = new FormData();
    fd.set("json", json);
    try {
      const res = await importarConfigDashboard(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo importar.");
        return;
      }
      setResultado({ emparejados: res.emparejados ?? [], sinEmparejar: res.sinEmparejar ?? [] });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="mb-1 text-[13px] font-bold">Importar configuración del dashboard anterior</div>
      <p className="mb-3.5 text-[11.5px] text-muted-2">
        Pegá o subí el JSON que exporta el botón &quot;Exportar clientes&quot; del dashboard de resultados anterior.
        Empareja por nombre contra clientes que ya existen acá — no crea clientes nuevos, solo completa sus IDs de
        GSC/GA4/Meta.
      </p>
      {error && <div className="mb-3 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">{error}</div>}
      {resultado && (
        <div className="mb-3 rounded-lg border border-success bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success">
          <div className="font-semibold">{resultado.emparejados.length} cliente(s) actualizados.</div>
          {resultado.emparejados.length > 0 && <div>{resultado.emparejados.join(", ")}</div>}
          {resultado.sinEmparejar.length > 0 && (
            <div className="mt-1 text-warning">Sin emparejar (no existen con ese nombre): {resultado.sinEmparejar.join(", ")}</div>
          )}
        </div>
      )}
      <input type="file" accept=".json,application/json" onChange={onFile} className="mb-2.5 text-[12px]" />
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='[{"name":"Cliente","url":"sc-domain:...","ga4":"...","meta":"act_..."}]'
        rows={5}
        className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11.5px] text-ink"
      />
      <button
        onClick={importar}
        disabled={pending || !json.trim()}
        className="btn-primary rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Importando…" : "Importar"}
      </button>
    </div>
  );
}
