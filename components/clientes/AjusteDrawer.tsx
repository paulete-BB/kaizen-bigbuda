"use client";

import { useState } from "react";
import { agregarDescuento, extenderServicio, registrarSalidaCliente } from "@/lib/data/clients-actions";
import type { ServicioActivoOpcion } from "@/lib/data/clients";
import { itemsBloqueantesSalida } from "@/lib/offboarding-items";

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
  clientes: { id: string; nombre: string; serviciosTipos: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("ext");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clienteSalidaId, setClienteSalidaId] = useState(clientes[0]?.id ?? "");
  const [bloqueantesMarcados, setBloqueantesMarcados] = useState<Set<string>>(new Set());
  const cfg = CFG[tipo];

  const clienteSalida = clientes.find((c) => c.id === clienteSalidaId);
  const bloqueantesSalida = clienteSalida ? itemsBloqueantesSalida(clienteSalida.serviciosTipos) : [];
  const faltanBloqueantes = bloqueantesSalida.some((item) => !bloqueantesMarcados.has(item));

  function abrir(t: Tipo) {
    setTipo(t);
    setError(null);
    setBloqueantesMarcados(new Set());
    if (t === "salida") setClienteSalidaId(clientes[0]?.id ?? "");
    setOpen(true);
  }

  function toggleBloqueante(item: string) {
    setBloqueantesMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
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
                    <select
                      name="clientId"
                      required
                      value={clienteSalidaId}
                      onChange={(e) => {
                        setClienteSalidaId(e.target.value);
                        setBloqueantesMarcados(new Set());
                      }}
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink"
                    >
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
                  {bloqueantesSalida.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-lg border border-danger-border bg-danger-bg p-3">
                      <span className="text-[11.5px] font-semibold text-danger">Confirma antes de dar de baja</span>
                      {bloqueantesSalida.map((item) => (
                        <label key={item} className="flex items-center gap-2 text-[12px] text-ink">
                          <input type="checkbox" checked={bloqueantesMarcados.has(item)} onChange={() => toggleBloqueante(item)} />
                          {item}
                        </label>
                      ))}
                    </div>
                  )}
                  <input type="hidden" name="bloqueantesConfirmados" value={faltanBloqueantes ? "" : "on"} />
                </>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending || (tipo === "salida" && faltanBloqueantes)}
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
