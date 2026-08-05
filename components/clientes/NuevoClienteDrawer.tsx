"use client";

import { useState } from "react";
import { crearCliente } from "@/lib/data/clients-actions";
import type { UsuarioResumen } from "@/lib/data/users";

type TipoServicio = "seo_aeo_geo" | "meta_ads" | "google_ads";

const SERVICIOS: { tipo: TipoServicio; label: string; ads: boolean }[] = [
  { tipo: "seo_aeo_geo", label: "SEO · AEO · GEO", ads: false },
  { tipo: "meta_ads", label: "Meta Ads", ads: true },
  { tipo: "google_ads", label: "Google Ads", ads: true },
];

export function NuevoClienteDrawer({ responsables }: { responsables: UsuarioResumen[] }) {
  const [open, setOpen] = useState(false);
  const [activos, setActivos] = useState<Record<TipoServicio, boolean>>({
    seo_aeo_geo: false,
    meta_ads: false,
    google_ads: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setActivos({ seo_aeo_geo: false, meta_ads: false, google_ads: false });
    setError(null);
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await crearCliente(formData);
      if (!res.ok) {
        setError(res.error ?? "No se pudo crear el cliente.");
        return;
      }
      setOpen(false);
      reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white"
      >
        Nuevo cliente
      </button>

      {open && (
        <div
          className="fixed inset-0 z-20 flex justify-end bg-black/30"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[460px] flex-col gap-4 overflow-y-auto bg-surface p-6"
            style={{ borderTop: "3px solid var(--color-accent)" }}
          >
            <div>
              <div className="text-[16px] font-bold">Nuevo cliente</div>
              <div className="text-[12.5px] text-muted-2">
                Al guardar se crea el checklist de onboarding; la primera optimización se programa recién cuando el
                onboarding bloqueante quede completo.
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">
                {error}
              </div>
            )}

            <form action={onSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Nombre del cliente</span>
                <input name="nombre" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Empresa</span>
                <input name="empresa" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <div className="flex gap-2.5">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Contacto</span>
                  <input name="contactoNombre" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Email del contacto</span>
                  <input type="email" name="contactoEmail" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
              </div>
              <div className="flex gap-2.5">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Teléfono (opcional)</span>
                  <input name="contactoTelefono" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Sitio web (opcional)</span>
                  <input name="sitioWeb" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Industria (opcional)</span>
                <input name="industria" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>

              <div className="mt-1 text-[11.5px] font-bold uppercase text-faint [letter-spacing:.03em]">
                Servicios a activar
              </div>

              {SERVICIOS.map((s) => (
                <div key={s.tipo} className="rounded-[10px] border border-border p-3">
                  <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                    <input
                      type="checkbox"
                      name={`servicio_${s.tipo}`}
                      checked={activos[s.tipo]}
                      onChange={(e) => setActivos((a) => ({ ...a, [s.tipo]: e.target.checked }))}
                    />
                    {s.label}
                  </label>

                  {activos[s.tipo] && (
                    <div className="mt-2.5 flex flex-col gap-2.5">
                      <div className="flex gap-2.5">
                        <label className="flex flex-1 flex-col gap-1.5">
                          <span className="text-[11px] font-semibold text-muted-2">Fecha de inicio</span>
                          <input
                            type="date"
                            name={`fechaInicio_${s.tipo}`}
                            defaultValue={new Date().toISOString().slice(0, 10)}
                            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1.5">
                          <span className="text-[11px] font-semibold text-muted-2">Período contratado</span>
                          <select
                            name={`periodoMeses_${s.tipo}`}
                            defaultValue=""
                            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                          >
                            <option value="">Indefinido</option>
                            <option value="3">3 meses</option>
                            <option value="6">6 meses</option>
                            <option value="12">12 meses</option>
                          </select>
                        </label>
                      </div>
                      {s.ads && (
                        <div className="flex gap-2.5">
                          <label className="flex flex-1 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-muted-2">Presupuesto mensual</span>
                            <input
                              type="number"
                              min={0}
                              name={`presupuesto_${s.tipo}`}
                              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                            />
                          </label>
                          <label className="flex w-[90px] flex-none flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-muted-2">Moneda</span>
                            <select
                              name={`moneda_${s.tipo}`}
                              defaultValue="CLP"
                              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                            >
                              <option value="CLP">CLP</option>
                              <option value="USD">USD</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-muted-2">Responsable</span>
                        <select
                          name={`responsable_${s.tipo}`}
                          defaultValue=""
                          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                        >
                          <option value="">Sin asignar</option>
                          {responsables.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              ))}

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary rounded-lg border-none bg-accent px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Creando…" : "Crear cliente"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
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
