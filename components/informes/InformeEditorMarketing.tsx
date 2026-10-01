"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { CampoArea, CampoTexto } from "@/components/informes/Campos";
import { ListaEditable } from "@/components/informes/ListaEditable";
import { InformeDeckPreview } from "@/components/informes/InformeDeckPreview";
import { cambiarEstadoInforme, guardarContenidoInforme, registrarEnvioInforme, type AccionInformeResultado } from "@/lib/data/informes-actions";
import { renderSlidesMarketing, type ServicioAdsTipo } from "@/lib/informes/slides-marketing";
import { fmtMesAnio, type InformeMarketingContenido } from "@/lib/informes/tipos";
import { CATALOGO_METRICAS_SUGERIDAS, criterioDeMetrica, criterioAFavorable, recalcularFavorablesConocidas, type Favorable } from "@/lib/informes/metricas-catalogo";
import type { InformeCompleto } from "@/lib/data/informes";

const OTRA_METRICA = "__otra__";

const LOGO_SRC = "/informes/logo-bigbuda.svg";

const ESTADO_LABEL = { borrador: "Borrador", listo: "Listo", enviado: "Enviado" } as const;

export function InformeEditorMarketing({ informe, usuario }: { informe: InformeCompleto; usuario: SidebarUsuario }) {
  const router = useRouter();
  const dirty = useRef(false);
  const [contenido, setContenido] = useState(() => {
    // Corrige en el momento filas de métricas conocidas guardadas con un
    // `favorable` viejo/incorrecto (ver lib/informes/metricas-catalogo.ts) —
    // así un informe ya creado no se queda en rojo hasta que alguien edite
    // cada fila a mano. El efecto de abajo marca `dirty` si hizo falta
    // corregir algo, para que el autosave persista la corrección solo.
    const inicial = informe.contenido as InformeMarketingContenido;
    const corregidas = recalcularFavorablesConocidas(inicial.comoVamosCifras.metricas);
    const cambio = corregidas.some((m, i) => m.favorable !== inicial.comoVamosCifras.metricas[i]?.favorable);
    return cambio ? { ...inicial, comoVamosCifras: { metricas: corregidas } } : inicial;
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envioAbierto, setEnvioAbierto] = useState(false);
  const soloLectura = informe.estado === "enviado";

  function actualizar(fn: (c: InformeMarketingContenido) => InformeMarketingContenido) {
    dirty.current = true;
    setContenido(fn);
  }

  useEffect(() => {
    const inicial = informe.contenido as InformeMarketingContenido;
    const corregidas = recalcularFavorablesConocidas(inicial.comoVamosCifras.metricas);
    const cambio = corregidas.some((m, i) => m.favorable !== inicial.comoVamosCifras.metricas[i]?.favorable);
    if (cambio) dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setGuardando(true);
      setError(null);
      const res = await guardarContenidoInforme(informe.id, contenido);
      dirty.current = false;
      setGuardando(false);
      if (!res.ok) setError(res.error ?? "No se pudo guardar.");
    }, 1000);
    return () => clearTimeout(t);
  }, [contenido, informe.id]);

  const mesAnioLabel = fmtMesAnio(informe.periodoMes, informe.periodoAnio);
  const slidesHtml = useMemo(
    () =>
      renderSlidesMarketing({
        clienteNombre: informe.clienteNombre,
        clienteEmpresa: informe.clienteEmpresa,
        contactoNombre: informe.contactoNombre,
        sitioWeb: informe.sitioWeb,
        mesAnioLabel,
        fechaSnapshotLabel: new Date().toLocaleDateString("es-CL"),
        logoSrc: LOGO_SRC,
        servicioTipo: informe.tipo as ServicioAdsTipo,
        contenido,
      }),
    [contenido, informe, mesAnioLabel],
  );

  async function marcarListo() {
    const fd = new FormData();
    fd.set("reportId", informe.id);
    fd.set("estado", informe.estado === "listo" ? "borrador" : "listo");
    const res: AccionInformeResultado = await cambiarEstadoInforme(fd);
    if (!res.ok) setError(res.error ?? "No se pudo cambiar el estado.");
    else router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href={`/clientes/${informe.clientId}/informes`} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {informe.clienteNombre} · Informes
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">{mesAnioLabel}</span>
          <div className="flex-1" />
          {guardando && <span className="text-[12px] text-muted-2">Guardando…</span>}
          {error && <span className="text-[12px] text-danger">{error}</span>}
          <Link href={`/informes/${informe.id}/imprimir`} target="_blank" className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] text-[12.5px] font-semibold text-ink">
            Vista de impresión
          </Link>
          {!soloLectura && (
            <button onClick={marcarListo} className="qa rounded-[9px] border border-border bg-surface px-[13px] py-[9px] text-[12.5px] font-semibold text-ink">
              {informe.estado === "listo" ? "Volver a borrador" : "Marcar como listo"}
            </button>
          )}
          {!soloLectura && (
            <button onClick={() => setEnvioAbierto(true)} className="btn-primary rounded-[9px] bg-accent px-[15px] py-2.5 text-[13px] font-semibold text-white">
              Registrar envío
            </button>
          )}
          {soloLectura && <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success">Enviado</span>}
        </header>

        {envioAbierto && <RegistrarEnvioModal reportId={informe.id} onClose={() => setEnvioAbierto(false)} onError={setError} />}

        <div className="flex w-full gap-6 px-[26px] pb-10 pt-[22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
              Estado: {ESTADO_LABEL[informe.estado]} — {soloLectura && "informe enviado, solo lectura"}
            </div>

            <fieldset disabled={soloLectura} className="flex flex-col gap-4 disabled:opacity-60">
              <Seccion titulo="Portada">
                <CampoArea
                  label="Bajada (una frase, admite **negrita**)"
                  value={contenido.portada.bajada}
                  onChange={(v) => actualizar((c) => ({ ...c, portada: { ...c.portada, bajada: v } }))}
                />
                <CampoTexto
                  label="Chips (separados por coma, el primero queda destacado)"
                  value={contenido.portada.chips.join(", ")}
                  onChange={(v) =>
                    actualizar((c) => ({ ...c, portada: { ...c.portada, chips: v.split(",").map((s) => s.trim()).filter(Boolean) } }))
                  }
                />
              </Seccion>

              <Seccion titulo="01 · ¿Cómo vamos? (cifras del mes)">
                <ListaEditable
                  items={contenido.comoVamosCifras.metricas}
                  vacio={{ etiqueta: OTRA_METRICA, valor: "", deltaTexto: "", deltaDireccion: "up" as const, favorable: "neutro" as const }}
                  addLabel="Agregar métrica"
                  onChange={(metricas) => actualizar((c) => ({ ...c, comoVamosCifras: { metricas } }))}
                  render={(item, onUpdate) => {
                    const esConocida = CATALOGO_METRICAS_SUGERIDAS.includes(item.etiqueta);
                    return (
                      <div className="flex flex-wrap gap-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-semibold text-muted-2">Métrica</span>
                          <select
                            value={esConocida ? item.etiqueta : OTRA_METRICA}
                            onChange={(e) => {
                              const etiqueta = e.target.value;
                              if (etiqueta === OTRA_METRICA) {
                                onUpdate({ etiqueta: "", favorable: "neutro" });
                                return;
                              }
                              // Al elegir una métrica conocida, el color se recalcula solo
                              // según su criterio (subir es bueno/malo/neutro) + la dirección
                              // ya cargada — nadie tiene que adivinar "¿es buena noticia?".
                              onUpdate({ etiqueta, favorable: criterioAFavorable(criterioDeMetrica(etiqueta), item.deltaDireccion) });
                            }}
                            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                          >
                            {CATALOGO_METRICAS_SUGERIDAS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            <option value={OTRA_METRICA}>Otra (personalizada)</option>
                          </select>
                        </label>
                        {!esConocida && (
                          <CampoTexto label="Nombre de la métrica" value={item.etiqueta} onChange={(v) => onUpdate({ etiqueta: v })} />
                        )}
                        <CampoTexto label="Valor" value={item.valor} onChange={(v) => onUpdate({ valor: v })} />
                        <CampoTexto label="Delta (ej: 6%)" value={item.deltaTexto} onChange={(v) => onUpdate({ deltaTexto: v })} />
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-semibold text-muted-2">Dirección</span>
                          <select
                            value={item.deltaDireccion}
                            onChange={(e) => {
                              const deltaDireccion = e.target.value as "up" | "down";
                              onUpdate(
                                esConocida
                                  ? { deltaDireccion, favorable: criterioAFavorable(criterioDeMetrica(item.etiqueta), deltaDireccion) }
                                  : { deltaDireccion },
                              );
                            }}
                            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                          >
                            <option value="up">↑ Sube</option>
                            <option value="down">↓ Baja</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-semibold text-muted-2">¿Es buena noticia?</span>
                          <select
                            value={item.favorable}
                            onChange={(e) => onUpdate({ favorable: e.target.value as Favorable })}
                            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                          >
                            <option value="bueno">Sí (verde)</option>
                            <option value="malo">No (rojo)</option>
                            <option value="neutro">Ninguna (neutro)</option>
                          </select>
                        </label>
                      </div>
                    );
                  }}
                />
              </Seccion>

              <Seccion titulo="01 · Inversión del mes">
                <div className="flex flex-wrap gap-2">
                  <CampoTexto label="Presupuesto acordado" value={contenido.inversionDelMes.presupuesto} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, presupuesto: v } }))} />
                  <CampoTexto label="Gasto real" value={contenido.inversionDelMes.gasto} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, gasto: v } }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <CampoTexto label="Día del mes" value={contenido.inversionDelMes.diaMes} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, diaMes: v } }))} />
                  <CampoTexto label="% del mes transcurrido" value={contenido.inversionDelMes.pctMesTranscurrido} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, pctMesTranscurrido: v } }))} />
                  <CampoTexto label="% del presupuesto ejecutado" value={contenido.inversionDelMes.pctEjecutado} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, pctEjecutado: v } }))} />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Estado del pacing</span>
                    <select
                      value={contenido.inversionDelMes.estado}
                      onChange={(e) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, estado: e.target.value as InformeMarketingContenido["inversionDelMes"]["estado"] } }))}
                      className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                    >
                      <option value="dentro_rango">Dentro de rango</option>
                      <option value="sobregasto">Sobre presupuesto</option>
                      <option value="subgasto">Bajo presupuesto</option>
                    </select>
                  </label>
                </div>
                <CampoArea label="Nota" value={contenido.inversionDelMes.nota} onChange={(v) => actualizar((c) => ({ ...c, inversionDelMes: { ...c.inversionDelMes, nota: v } }))} />
              </Seccion>

              <Seccion titulo="02 · ¿Qué mejoramos?">
                <ListaEditable
                  items={contenido.queMejoramos.acciones}
                  vacio={{ accion: "", efecto: "" }}
                  addLabel="Agregar acción"
                  onChange={(acciones) => actualizar((c) => ({ ...c, queMejoramos: { acciones } }))}
                  render={(item, onUpdate) => (
                    <div className="flex flex-col gap-2">
                      <CampoTexto label="Qué hicimos" value={item.accion} onChange={(v) => onUpdate({ accion: v })} />
                      <CampoTexto label="Efecto" value={item.efecto} onChange={(v) => onUpdate({ efecto: v })} />
                    </div>
                  )}
                />
              </Seccion>

              <Seccion titulo="03 · ¿Qué proyectamos?">
                <CampoArea
                  label="Qué esperar en el próximo período"
                  value={contenido.queProyectamos.queEsperar}
                  onChange={(v) => actualizar((c) => ({ ...c, queProyectamos: { ...c.queProyectamos, queEsperar: v } }))}
                />
                <CampoArea
                  label="El insight del mes (admite **negrita**)"
                  filas={4}
                  value={contenido.queProyectamos.insight}
                  onChange={(v) => actualizar((c) => ({ ...c, queProyectamos: { ...c.queProyectamos, insight: v } }))}
                />
              </Seccion>
            </fieldset>
          </div>

          <div className="flex-none">
            <div className="sticky top-[88px] rounded-[14px] border border-border bg-surface p-3">
              <div className="mb-2 text-[11.5px] font-semibold text-muted-2">Vista previa</div>
              <InformeDeckPreview slidesHtml={slidesHtml} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-[14px] border border-border bg-surface p-5">
      <summary className="cursor-pointer text-[13.5px] font-bold">{titulo}</summary>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </details>
  );
}

function RegistrarEnvioModal({ reportId, onClose, onError }: { reportId: string; onClose: () => void; onError: (e: string) => void }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function enviar(formData: FormData) {
    setEnviando(true);
    const res = await registrarEnvioInforme(formData);
    setEnviando(false);
    if (!res.ok) {
      onError(res.error ?? "No se pudo registrar el envío.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form action={enviar} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-sm flex-col gap-4 rounded-[14px] border border-border bg-surface p-6">
        <div className="text-[14.5px] font-bold">Registrar envío del informe</div>
        <input type="hidden" name="reportId" value={reportId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Medio</span>
          <input name="medio" placeholder="Email / WhatsApp / otro" required className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Destinatario</span>
          <input name="destinatario" placeholder="contacto@cliente.cl" required className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-muted">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="btn-primary rounded-lg border-none bg-accent px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {enviando ? "Registrando…" : "Confirmar envío"}
          </button>
        </div>
      </form>
    </div>
  );
}
