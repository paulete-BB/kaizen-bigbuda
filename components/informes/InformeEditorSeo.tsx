"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { CampoArea, CampoTexto } from "@/components/informes/Campos";
import { ListaEditable } from "@/components/informes/ListaEditable";
import { ListaTextosEditable } from "@/components/informes/ListaTextosEditable";
import { InformeDeckPreview } from "@/components/informes/InformeDeckPreview";
import { cambiarEstadoInforme, guardarContenidoInforme, registrarEnvioInforme, type AccionInformeResultado } from "@/lib/data/informes-actions";
import { renderSlidesSeo } from "@/lib/informes/slides-seo";
import { fmtMesAnio, type InformeSeoContenido } from "@/lib/informes/tipos";
import type { InformeCompleto } from "@/lib/data/informes";

const LOGO_SRC = "/informes/logo-bigbuda.svg";

const ESTADO_LABEL = { borrador: "Borrador", listo: "Listo", enviado: "Enviado" } as const;

export function InformeEditorSeo({ informe, usuario }: { informe: InformeCompleto; usuario: SidebarUsuario }) {
  const router = useRouter();
  const [contenido, setContenido] = useState(informe.contenido as InformeSeoContenido);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envioAbierto, setEnvioAbierto] = useState(false);
  const dirty = useRef(false);
  const soloLectura = informe.estado === "enviado";

  function actualizar(fn: (c: InformeSeoContenido) => InformeSeoContenido) {
    dirty.current = true;
    setContenido(fn);
  }

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
      renderSlidesSeo({
        clienteNombre: informe.clienteNombre,
        clienteEmpresa: informe.clienteEmpresa,
        contactoNombre: informe.contactoNombre,
        sitioWeb: informe.sitioWeb,
        mesAnioLabel,
        fechaSnapshotLabel: new Date().toLocaleDateString("es-CL"),
        logoSrc: LOGO_SRC,
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

        {envioAbierto && (
          <RegistrarEnvioModal reportId={informe.id} onClose={() => setEnvioAbierto(false)} onError={setError} />
        )}

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
                  label="Chips de servicio/industria (separados por coma, el último queda destacado)"
                  value={contenido.portada.chips.join(", ")}
                  onChange={(v) =>
                    actualizar((c) => ({ ...c, portada: { ...c.portada, chips: v.split(",").map((s) => s.trim()).filter(Boolean) } }))
                  }
                />
              </Seccion>

              <Seccion titulo="01 · En una frase">
                <CampoArea
                  label="Idea principal (admite **negrita**)"
                  value={contenido.enUnaFrase.principal}
                  onChange={(v) => actualizar((c) => ({ ...c, enUnaFrase: { ...c.enUnaFrase, principal: v } }))}
                />
                <CampoArea
                  label="Idea secundaria (admite **negrita**)"
                  value={contenido.enUnaFrase.secundario}
                  onChange={(v) => actualizar((c) => ({ ...c, enUnaFrase: { ...c.enUnaFrase, secundario: v } }))}
                />
              </Seccion>

              <Seccion titulo="02 · Nuestro enfoque">
                <div className="flex gap-3">
                  <CampoTexto label="Cita del cliente (opcional)" value={contenido.nuestroEnfoque.cita} onChange={(v) => actualizar((c) => ({ ...c, nuestroEnfoque: { ...c.nuestroEnfoque, cita: v } }))} />
                  <CampoTexto label="Autor de la cita" value={contenido.nuestroEnfoque.citaAutor} onChange={(v) => actualizar((c) => ({ ...c, nuestroEnfoque: { ...c.nuestroEnfoque, citaAutor: v } }))} />
                </div>
                <CampoArea label="Contexto de negocio" value={contenido.nuestroEnfoque.contexto} onChange={(v) => actualizar((c) => ({ ...c, nuestroEnfoque: { ...c.nuestroEnfoque, contexto: v } }))} />
                <div className="text-[11.5px] font-semibold text-muted-2">Decisiones (lo que decidimos no hacer)</div>
                <ListaEditable
                  items={contenido.nuestroEnfoque.decisiones}
                  vacio={{ titulo: "", descripcion: "" }}
                  onChange={(items) => actualizar((c) => ({ ...c, nuestroEnfoque: { ...c.nuestroEnfoque, decisiones: items } }))}
                  addLabel="Agregar decisión"
                  render={(item, onUpdate) => (
                    <div className="flex flex-col gap-2">
                      <CampoTexto label="Título" value={item.titulo} onChange={(v) => onUpdate({ titulo: v })} />
                      <CampoArea label="Descripción" filas={2} value={item.descripcion} onChange={(v) => onUpdate({ descripcion: v })} />
                    </div>
                  )}
                />
              </Seccion>

              <Seccion titulo="03 · Punto de partida (métricas de diagnóstico)">
                <ListaEditable
                  items={contenido.puntoDePartida.metricas}
                  vacio={{ valor: "", etiqueta: "", descripcion: "" }}
                  onChange={(items) => actualizar((c) => ({ ...c, puntoDePartida: { metricas: items } }))}
                  addLabel="Agregar métrica"
                  render={(item, onUpdate) => (
                    <div className="flex gap-2">
                      <CampoTexto label="Valor (ej: 7,2 / 68% / 2.º)" value={item.valor} onChange={(v) => onUpdate({ valor: v })} />
                      <CampoTexto label="Etiqueta" value={item.etiqueta} onChange={(v) => onUpdate({ etiqueta: v })} />
                      <CampoTexto label="Descripción de una línea" value={item.descripcion} onChange={(v) => onUpdate({ descripcion: v })} />
                    </div>
                  )}
                />
              </Seccion>

              <Seccion titulo="04 · Lo que dejamos funcionando (SEO / AEO·IA / GEO)">
                {contenido.loQueDejamosFuncionando.columnas.map((col, i) => (
                  <div key={i} className="rounded-lg border border-border-soft-2 p-3">
                    <div className="mb-2 flex gap-2">
                      <CampoTexto
                        label="Título columna"
                        value={col.titulo}
                        onChange={(v) =>
                          actualizar((c) => ({
                            ...c,
                            loQueDejamosFuncionando: {
                              columnas: c.loQueDejamosFuncionando.columnas.map((x, idx) => (idx === i ? { ...x, titulo: v } : x)),
                            },
                          }))
                        }
                      />
                      <CampoTexto
                        label="Subtítulo"
                        value={col.subtitulo}
                        onChange={(v) =>
                          actualizar((c) => ({
                            ...c,
                            loQueDejamosFuncionando: {
                              columnas: c.loQueDejamosFuncionando.columnas.map((x, idx) => (idx === i ? { ...x, subtitulo: v } : x)),
                            },
                          }))
                        }
                      />
                    </div>
                    <ListaTextosEditable
                      items={col.bullets}
                      addLabel="Agregar bullet"
                      onChange={(bullets) =>
                        actualizar((c) => ({
                          ...c,
                          loQueDejamosFuncionando: {
                            columnas: c.loQueDejamosFuncionando.columnas.map((x, idx) => (idx === i ? { ...x, bullets } : x)),
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </Seccion>

              {contenido.detalles.map((bloque, i) => (
                <Seccion key={i} titulo={`04+ · ${bloque.titulo || "Detalle"}`}>
                  <CampoTexto
                    label="Título del bloque"
                    value={bloque.titulo}
                    onChange={(v) => actualizar((c) => ({ ...c, detalles: c.detalles.map((b, idx) => (idx === i ? { ...b, titulo: v } : b)) }))}
                  />
                  <ListaEditable
                    items={bloque.items}
                    vacio={{ titulo: "", porque: "" }}
                    addLabel="Agregar acción"
                    onChange={(items) => actualizar((c) => ({ ...c, detalles: c.detalles.map((b, idx) => (idx === i ? { ...b, items } : b)) }))}
                    render={(item, onUpdate) => (
                      <div className="flex flex-col gap-2">
                        <CampoTexto label="Qué hicimos" value={item.titulo} onChange={(v) => onUpdate({ titulo: v })} />
                        <CampoArea label="Por qué" filas={2} value={item.porque} onChange={(v) => onUpdate({ porque: v })} />
                      </div>
                    )}
                  />
                </Seccion>
              ))}

              <Seccion titulo="05 · Resultados en números">
                <ListaEditable
                  items={contenido.resultadosNumeros.cifras}
                  vacio={{ valor: "", etiqueta: "", descripcion: "" }}
                  addLabel="Agregar cifra"
                  onChange={(items) => actualizar((c) => ({ ...c, resultadosNumeros: { cifras: items } }))}
                  render={(item, onUpdate) => (
                    <div className="flex gap-2">
                      <CampoTexto label="Valor" value={item.valor} onChange={(v) => onUpdate({ valor: v })} />
                      <CampoArea label="Descripción (ej: con '(antes: X)')" filas={2} value={item.descripcion} onChange={(v) => onUpdate({ descripcion: v })} />
                    </div>
                  )}
                />
              </Seccion>

              <Seccion titulo="05 · Tráfico desde IA (opcional)">
                <SeccionOpcionalToggle
                  activo={contenido.traficoIA !== null}
                  onActivar={() => actualizar((c) => ({ ...c, traficoIA: { totalSesiones: "", filas: [] } }))}
                  onQuitar={() => actualizar((c) => ({ ...c, traficoIA: null }))}
                >
                  {contenido.traficoIA && (
                    <>
                      <CampoTexto
                        label="Total sesiones desde IA"
                        value={contenido.traficoIA.totalSesiones}
                        onChange={(v) => actualizar((c) => ({ ...c, traficoIA: c.traficoIA && { ...c.traficoIA, totalSesiones: v } }))}
                      />
                      <ListaEditable
                        items={contenido.traficoIA.filas}
                        vacio={{ fuente: "", sesiones: "", usuarios: "", conversiones: "" }}
                        addLabel="Agregar fuente"
                        onChange={(filas) => actualizar((c) => ({ ...c, traficoIA: c.traficoIA && { ...c.traficoIA, filas } }))}
                        render={(item, onUpdate) => (
                          <div className="flex gap-2">
                            <CampoTexto label="Fuente" value={item.fuente} onChange={(v) => onUpdate({ fuente: v })} />
                            <CampoTexto label="Sesiones" value={item.sesiones} onChange={(v) => onUpdate({ sesiones: v })} />
                            <CampoTexto label="Usuarios" value={item.usuarios} onChange={(v) => onUpdate({ usuarios: v })} />
                            <CampoTexto label="Conversiones" value={item.conversiones} onChange={(v) => onUpdate({ conversiones: v })} />
                          </div>
                        )}
                      />
                    </>
                  )}
                </SeccionOpcionalToggle>
              </Seccion>

              <Seccion titulo="05 · Antes / Después (opcional)">
                <SeccionOpcionalToggle
                  activo={contenido.antesDespues !== null}
                  onActivar={() => actualizar((c) => ({ ...c, antesDespues: { pares: [], nota: "" } }))}
                  onQuitar={() => actualizar((c) => ({ ...c, antesDespues: null }))}
                >
                  {contenido.antesDespues && (
                    <>
                      <ListaEditable
                        items={contenido.antesDespues.pares}
                        vacio={{ etiqueta: "", antes: "", despues: "" }}
                        addLabel="Agregar par"
                        onChange={(pares) => actualizar((c) => ({ ...c, antesDespues: c.antesDespues && { ...c.antesDespues, pares } }))}
                        render={(item, onUpdate) => (
                          <div className="flex flex-col gap-2">
                            <CampoTexto label="Etiqueta de contexto" value={item.etiqueta} onChange={(v) => onUpdate({ etiqueta: v })} />
                            <CampoTexto label="Título antiguo (se tacha)" value={item.antes} onChange={(v) => onUpdate({ antes: v })} />
                            <CampoTexto label="Título nuevo" value={item.despues} onChange={(v) => onUpdate({ despues: v })} />
                          </div>
                        )}
                      />
                      <CampoArea
                        label="Nota final (admite **negrita**)"
                        value={contenido.antesDespues.nota}
                        onChange={(v) => actualizar((c) => ({ ...c, antesDespues: c.antesDespues && { ...c.antesDespues, nota: v } }))}
                      />
                    </>
                  )}
                </SeccionOpcionalToggle>
              </Seccion>

              <Seccion titulo="06 · Impacto proyectado">
                <ListaEditable
                  items={contenido.impactoProyectado.horizontes}
                  vacio={{ etiqueta: "", titulo: "", descripcion: "" }}
                  addLabel="Agregar horizonte"
                  onChange={(horizontes) => actualizar((c) => ({ ...c, impactoProyectado: { ...c.impactoProyectado, horizontes } }))}
                  render={(item, onUpdate) => (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <CampoTexto label="Etiqueta (ej: Semanas 2-4)" value={item.etiqueta} onChange={(v) => onUpdate({ etiqueta: v })} />
                        <CampoTexto label="Título" value={item.titulo} onChange={(v) => onUpdate({ titulo: v })} />
                      </div>
                      <CampoArea label="Descripción" filas={2} value={item.descripcion} onChange={(v) => onUpdate({ descripcion: v })} />
                    </div>
                  )}
                />
                <CampoArea
                  label="Nota final destacada (admite **negrita**)"
                  value={contenido.impactoProyectado.nota}
                  onChange={(v) => actualizar((c) => ({ ...c, impactoProyectado: { ...c.impactoProyectado, nota: v } }))}
                />
              </Seccion>

              <Seccion titulo="07 · Hoja de ruta">
                <ListaEditable
                  items={contenido.hojaDeRuta.pasos}
                  vacio={{ titulo: "", descripcion: "" }}
                  addLabel="Agregar paso"
                  onChange={(pasos) => actualizar((c) => ({ ...c, hojaDeRuta: { pasos } }))}
                  render={(item, onUpdate) => (
                    <div className="flex flex-col gap-2">
                      <CampoTexto label="Título" value={item.titulo} onChange={(v) => onUpdate({ titulo: v })} />
                      <CampoArea label="Descripción" filas={2} value={item.descripcion} onChange={(v) => onUpdate({ descripcion: v })} />
                    </div>
                  )}
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

function SeccionOpcionalToggle({
  activo,
  onActivar,
  onQuitar,
  children,
}: {
  activo: boolean;
  onActivar: () => void;
  onQuitar: () => void;
  children: React.ReactNode;
}) {
  if (!activo) {
    return (
      <button type="button" onClick={onActivar} className="ghost self-start rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] font-semibold text-muted">
        + Incluir esta slide
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {children}
      <button type="button" onClick={onQuitar} className="xbtn self-start rounded-lg px-3 py-1.5 text-[12px] text-muted-2">
        Quitar esta slide del informe
      </button>
    </div>
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
        <CampoTextoNombreForm label="Medio" name="medio" placeholder="Email / WhatsApp / otro" />
        <CampoTextoNombreForm label="Destinatario" name="destinatario" placeholder="contacto@cliente.cl" />
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

function CampoTextoNombreForm({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-muted-2">{label}</span>
      <input name={name} placeholder={placeholder} required className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink" />
    </label>
  );
}
