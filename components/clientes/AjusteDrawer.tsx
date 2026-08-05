"use client";

import { useState } from "react";
import { agregarDescuento, extenderServicio, registrarSalidaCliente } from "@/lib/data/clients-actions";
import type { ServicioActivoOpcion } from "@/lib/data/clients";

type Tipo = "ext" | "desc" | "salida";

const CFG: Record<Tipo, { accent: string; title: string; sub: string; cta: string }> = {
  ext: { accent: "var(--color-success)", title: "Extensión de servicio", sub: "Renovar o ampliar el período contratado", cta: "Guardar extensión" },
  desc: { accent: "var(--color-warning)", title: "Extensión / nuevo descuento", sub: "Prorrogar o crear un descuento", cta: "Guardar descuento" },
  salida: { accent: "var(--color-danger)", title: "Salida de cliente", sub: "Registrar no renovación o baja", cta: "Registrar salida" },
};

const SERVICE_LABEL: Record<string, string> = {
  seo_aeo_geo: "Posicionamiento (SEO · AEO · GEO)",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export function AjusteDrawer({
  servicios,
  clientes,
}: {
  servicios: ServicioActivoOpcion[];
  clientes: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("ext");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = CFG[tipo];

  function abrir(t: Tipo) {
    setTipo(t);
    setError(null);
    setOpen(true);
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      if (tipo === "ext") {
        await extenderServicio(formData);
      } else if (tipo === "desc") {
        await agregarDescuento(formData);
      } else {
        const res = await registrarSalidaCliente(formData);
        if (!res.ok) {
          setError(res.error ?? "No se pudo registrar la salida.");
          return;
        }
      }
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        <button
          onClick={() => abrir("ext")}
          className="qa rounded-[10px] border border-border bg-surface p-3 text-left text-[12.5px] font-semibold text-ink"
        >
          Extensión de servicio
        </button>
        <button
          onClick={() => abrir("desc")}
          className="qa rounded-[10px] border border-border bg-surface p-3 text-left text-[12.5px] font-semibold text-ink"
        >
          Extensión / nuevo descuento
        </button>
        <button
          onClick={() => abrir("salida")}
          className="qa rounded-[10px] border border-border bg-surface p-3 text-left text-[12.5px] font-semibold text-ink"
        >
          Salida de cliente
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[420px] flex-col gap-4 overflow-y-auto bg-surface p-6"
            style={{ borderTop: `3px solid ${cfg.accent}` }}
          >
            <div>
              <div className="text-[16px] font-bold">{cfg.title}</div>
              <div className="text-[12.5px] text-muted-2">{cfg.sub}</div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>
            )}

            <form action={onSubmit} className="flex flex-col gap-3.5">
              {tipo === "ext" && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Servicio</span>
                    <select name="serviceId" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink">
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.clienteNombre} — {SERVICE_LABEL[s.tipo] ?? s.tipo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Nueva vigencia hasta</span>
                    <input type="date" name="nuevaFecha" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Notas</span>
                    <textarea name="notas" rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                  </label>
                </>
              )}

              {tipo === "desc" && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Cliente</span>
                    <select name="clientId" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink">
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Descripción</span>
                    <input type="text" name="descripcion" required placeholder="Ej. Bono fidelidad" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                  </label>
                  <div className="flex gap-2.5">
                    <label className="flex w-[100px] flex-none flex-col gap-1.5">
                      <span className="text-[11.5px] font-semibold text-muted-2">Descuento %</span>
                      <input type="number" name="valor" min={1} max={100} defaultValue={10} required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                    </label>
                    <label className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[11.5px] font-semibold text-muted-2">Vence</span>
                      <input type="date" name="fechaTermino" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-muted">
                    <input type="checkbox" name="esProrroga" />
                    Es prórroga de un descuento existente
                  </label>
                </>
              )}

              {tipo === "salida" && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Cliente</span>
                    <select name="clientId" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink">
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11.5px] text-muted-2">
                    Marca al cliente como finalizado. Su historial queda archivado y consultable.
                  </p>
                </>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary rounded-lg border-none px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
                  style={{ background: cfg.accent }}
                >
                  {pending ? "Guardando…" : cfg.cta}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ghost rounded-lg border border-border bg-surface px-4 py-2.5 font-sans text-[12.5px] font-semibold text-muted"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
