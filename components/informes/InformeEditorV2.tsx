"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { CampoTexto } from "@/components/informes/Campos";
import { ListaTextosEditable } from "@/components/informes/ListaTextosEditable";
import { InformeDeckPreview } from "@/components/informes/InformeDeckPreview";
import { actualizarDatosInforme, cambiarEstadoInforme, guardarContenidoInforme, registrarEnvioInforme, type AccionInformeResultado } from "@/lib/data/informes-actions";
import { fmtMesAnio } from "@/lib/informes/tipos";
import { fechaLarga, rangoLargo, renderSlidesV2, seccionesSinDatos } from "@/lib/informes/v2/slides";
import { construirPromptInsights, ETIQUETA_SECCION, parsearRespuesta, seccionesDeInsights } from "@/lib/informes/v2/insights";
import { INSIGHTS_POR_SECCION, LARGO_INSIGHT_MAX, LARGO_INSIGHT_OBJETIVO, type InformeV2Contenido, type SeccionInsight } from "@/lib/informes/v2/tipos";
import type { InformeCompleto } from "@/lib/data/informes";

const ESTADO_LABEL = { borrador: "Borrador", listo: "Listo", enviado: "Enviado" } as const;

export function InformeEditorV2({ informe, contenidoInicial, usuario }: { informe: InformeCompleto; contenidoInicial: InformeV2Contenido; usuario: SidebarUsuario }) {
  const router = useRouter();
  const dirty = useRef(false);
  const [contenido, setContenido] = useState(contenidoInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envioAbierto, setEnvioAbierto] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [pegado, setPegado] = useState("");
  const [fechaDesde, setFechaDesde] = useState(contenidoInicial.periodo.desde);
  const [fechaHasta, setFechaHasta] = useState(contenidoInicial.periodo.hasta);
  const [aviso, setAviso] = useState<string | null>(null);
  const soloLectura = informe.estado === "enviado";

  function actualizar(fn: (c: InformeV2Contenido) => InformeV2Contenido) {
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
      renderSlidesV2({
        clienteNombre: informe.clienteNombre,
        clienteEmpresa: informe.clienteEmpresa,
        contactoNombre: informe.contactoNombre,
        mesAnioLabel,
        tipo: informe.tipo,
        contenido,
        logoSrc: "/informes/logo-bigbuda-dark.svg",
      }),
    [contenido, informe, mesAnioLabel],
  );

  const secciones = seccionesDeInsights(informe.tipo, contenido);
  const faltantes = seccionesSinDatos(contenido, informe.tipo);
  const prompt = useMemo(
    () => construirPromptInsights({ clienteNombre: informe.clienteNombre, industria: informe.industria, mesAnioLabel, tipo: informe.tipo, contenido }),
    [informe, mesAnioLabel, contenido],
  );

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar al portapapeles: selecciona el texto de abajo y cópialo a mano.");
    }
  }

  function cargarRespuesta() {
    const r = parsearRespuesta(pegado);
    const cargadas = secciones.filter((s) => (r.insights[s]?.length ?? 0) > 0);
    if (cargadas.length === 0 && r.hechos.length === 0 && r.proximos.length === 0) {
      setAviso("No encontré nada. Pega la respuesta de Claude con los títulos (## SEO · AEO · GEO, ## Meta Ads, ## Lo que hicimos, ## Lo que viene) y las frases con guion.");
      return;
    }
    actualizar((c) => {
      const insights = { ...c.insights };
      for (const s of cargadas) insights[s] = (r.insights[s] ?? []).slice(0, INSIGHTS_POR_SECCION);
      return { ...c, insights, hechos: r.hechos.length ? r.hechos.slice(0, 8) : c.hechos, proximos: r.proximos.length ? r.proximos.slice(0, 5) : c.proximos };
    });
    const partes = cargadas.map((s) => `${Math.min(r.insights[s]!.length, INSIGHTS_POR_SECCION)} de ${ETIQUETA_SECCION[s]}`);
    if (r.hechos.length) partes.push(`${Math.min(r.hechos.length, 8)} de "Lo que hicimos"`);
    if (r.proximos.length) partes.push(`${Math.min(r.proximos.length, 5)} de "Lo que viene"`);
    setAviso(`Cargué ${partes.join(", ")}. Revísalas abajo antes de enviar.`);
    setPegado("");
  }

  function setFrase(s: SeccionInsight, i: number, v: string) {
    actualizar((c) => {
      const frases = [...c.insights[s]];
      while (frases.length < INSIGHTS_POR_SECCION) frases.push("");
      frases[i] = v;
      return { ...c, insights: { ...c.insights, [s]: frases } };
    });
  }

  async function refrescarDatos(rango?: { desde: string; hasta: string } | null) {
    setActualizando(true);
    setError(null);
    const res = await actualizarDatosInforme(informe.id, rango);
    setActualizando(false);
    if (!res.ok || !res.contenido) setError(res.error ?? "No se pudieron actualizar los datos.");
    else {
      dirty.current = false;
      setContenido(res.contenido);
      setFechaDesde(res.contenido.periodo.desde);
      setFechaHasta(res.contenido.periodo.hasta);
      setAviso("Datos actualizados.");
    }
  }

  async function marcarListo() {
    const fd = new FormData();
    fd.set("reportId", informe.id);
    fd.set("estado", informe.estado === "listo" ? "borrador" : "listo");
    const res: AccionInformeResultado = await cambiarEstadoInforme(fd);
    if (!res.ok) setError(res.error ?? "No se pudo cambiar el estado.");
    else router.refresh();
  }

  const pendientes = secciones.filter((s) => contenido.insights[s].filter((f) => f.trim()).length < INSIGHTS_POR_SECCION);

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
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">
              Estado: {ESTADO_LABEL[informe.estado]}
              {soloLectura && " — informe enviado, solo lectura"}
            </div>

            <Seccion titulo="Datos del informe (automáticos)">
              <p className="text-[12.5px] text-muted-2">
                Los gráficos y cifras son los mismos de la pestaña Resultados, tomados el {fechaLarga(contenido.periodo.emitidoEn)} para el período {rangoLargo(contenido.periodo.desde, contenido.periodo.hasta)}. No hay nada que llenar a mano.
              </p>
              {faltantes.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
                  <b>Faltan datos de:</b>
                  <ul className="ml-4 list-disc">
                    {faltantes.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  Esas páginas no salen en el informe hasta que el dato esté disponible.
                </div>
              )}
              {!soloLectura && (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="text-[12px] font-semibold text-muted-2">
                    Período: {contenido.periodo.personalizado ? "fechas elegidas a mano" : "mes completo"}. Para casos especiales elige otras fechas (se compara con el período de igual largo anterior).
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11.5px] font-semibold text-muted-2">Desde</span>
                      <input type="date" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11.5px] font-semibold text-muted-2">Hasta</span>
                      <input type="date" value={fechaHasta} min={fechaDesde} onChange={(e) => setFechaHasta(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink" />
                    </label>
                    <button type="button" onClick={() => refrescarDatos({ desde: fechaDesde, hasta: fechaHasta })} disabled={actualizando || !fechaDesde || !fechaHasta} className="btn-primary rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">
                      {actualizando ? "Actualizando…" : "Aplicar fechas"}
                    </button>
                    {contenido.periodo.personalizado && (
                      <button type="button" onClick={() => refrescarDatos(null)} disabled={actualizando} className="ghost rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold text-muted disabled:opacity-60">
                        Volver al mes completo
                      </button>
                    )}
                    <button type="button" onClick={() => refrescarDatos()} disabled={actualizando} className="ghost rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold text-muted disabled:opacity-60">
                      Actualizar datos
                    </button>
                  </div>
                </div>
              )}
            </Seccion>

            <fieldset disabled={soloLectura} className="flex flex-col gap-4 disabled:opacity-60">
              <Seccion titulo={`Insights con Claude (${secciones.length === 0 ? "sin datos todavía" : pendientes.length === 0 ? "completos" : `faltan ${pendientes.map((s) => ETIQUETA_SECCION[s]).join(", ")}`})`}>
                <ol className="ml-4 list-decimal text-[12.5px] text-muted">
                  <li>Copia el prompt y pégalo en Claude (claude.ai o la extensión del navegador; empieza llamando a la skill /paid_media_senior).</li>
                  <li>Pega aquí abajo la respuesta de Claude y cárgala: llena los insights, «Lo que hicimos» y «Lo que viene».</li>
                  <li>Revisa cada frase: apunta a ~{LARGO_INSIGHT_OBJETIVO} caracteres.</li>
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={copiarPrompt} className="btn-primary rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white">
                    {copiado ? "¡Copiado!" : "Copiar prompt para Claude"}
                  </button>
                  <span className="text-[11.5px] text-muted-2">Incluye cifras, keywords/campañas y lo que se hizo en el período.</span>
                </div>
                <details>
                  <summary className="cursor-pointer text-[12px] font-semibold text-muted-2">Ver el prompt</summary>
                  <textarea readOnly value={prompt} rows={10} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11.5px] text-ink" />
                </details>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Respuesta de Claude</span>
                  <textarea
                    value={pegado}
                    onChange={(e) => setPegado(e.target.value)}
                    rows={6}
                    placeholder={"## SEO · AEO · GEO\n- Primera frase…\n- Segunda frase…\n- Tercera frase…"}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                  />
                </label>
                <button type="button" onClick={cargarRespuesta} disabled={!pegado.trim()} className="ghost self-start rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold text-muted disabled:opacity-50">
                  Cargar insights
                </button>
                {aviso && <p className="text-[12.5px] font-semibold text-success">{aviso}</p>}

                {secciones.map((s) => (
                  <div key={s} className="flex flex-col gap-2 border-t border-border pt-3">
                    <div className="text-[12.5px] font-bold">{ETIQUETA_SECCION[s]}</div>
                    {Array.from({ length: INSIGHTS_POR_SECCION }, (_, i) => {
                      const valor = contenido.insights[s][i] ?? "";
                      const n = valor.length;
                      const color = n > LARGO_INSIGHT_MAX ? "text-danger" : n > LARGO_INSIGHT_OBJETIVO + 15 ? "text-amber-700" : "text-muted-2";
                      return (
                        <label key={i} className="flex flex-col gap-1">
                          <textarea
                            value={valor}
                            onChange={(e) => setFrase(s, i, e.target.value)}
                            rows={2}
                            placeholder={`Insight ${i + 1}`}
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                          />
                          <span className={`self-end text-[11px] ${color}`}>
                            {n} / {LARGO_INSIGHT_OBJETIVO} caracteres{n > LARGO_INSIGHT_MAX ? " — muy larga" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                {secciones.length === 0 && <p className="text-[12.5px] text-muted-2">Este informe no tiene secciones con datos para generar insights.</p>}
              </Seccion>

              <Seccion titulo="Lo que hicimos">
                <ListaTextosEditable items={contenido.hechos} addLabel="Agregar acción" onChange={(hechos) => actualizar((c) => ({ ...c, hechos }))} />
              </Seccion>

              <Seccion titulo="Lo que viene (máx. 5)">
                <ListaTextosEditable items={contenido.proximos} addLabel="Agregar próximo paso" onChange={(proximos) => actualizar((c) => ({ ...c, proximos: proximos.slice(0, 5) }))} />
              </Seccion>

              <Seccion titulo="Cierre">
                <CampoTexto label="Link para agendar la reunión" value={contenido.agendaUrl} onChange={(v) => actualizar((c) => ({ ...c, agendaUrl: v }))} />
              </Seccion>
            </fieldset>
          </div>
          <div className="flex-none">
            <div className="sticky top-[88px] rounded-[14px] border border-border bg-surface p-3">
              <div className="mb-2 text-[11.5px] font-semibold text-muted-2">Vista previa</div>
              <div style={{ maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
                <InformeDeckPreview slidesHtml={slidesHtml} variante="v2" />
              </div>
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
