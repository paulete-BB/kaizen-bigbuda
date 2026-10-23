"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { actualizarEstadoItemPlan, cerrarOptimizacionConAgente } from "@/lib/data/agente-actions";
import { TIPO_ITEM_LABEL, type EstadoItemPlan, type EventoAgente, type ItemPlan } from "@/lib/agente/tipos";
import type { AgenteVista, MensajeVista } from "@/lib/data/agente";
import { fmtFecha } from "@/lib/dates";

const CANAL = {
  meta_ads: { label: "Meta Ads", color: "#2563eb", bg: "#e8f0fe" },
  google_ads: { label: "Google Ads", color: "#0d9488", bg: "#e3f4f2" },
} as const;

const PRIORIDAD_COLOR = { alta: "var(--color-danger)", media: "var(--color-warning)", baja: "var(--color-muted-2)" } as const;

const NOMBRE_HERRAMIENTA: Record<string, string> = {
  historial_optimizaciones: "Leyendo historial",
  bitacora_reciente: "Leyendo bitácora",
  pacing_presupuesto: "Revisando presupuesto",
  aprobaciones_abiertas: "Revisando aprobaciones",
  meta_resumen_cuenta: "Consultando cuenta de Meta",
  meta_campanas: "Consultando campañas de Meta",
  meta_serie_diaria: "Consultando serie diaria de Meta",
  ga4_conversiones_paid_social: "Consultando conversiones en GA4",
  google_ads_resumen_ga4: "Consultando Google Ads en GA4",
  google_ads_campanas_ga4: "Consultando campañas en GA4",
  google_ads_serie_diaria_ga4: "Consultando serie diaria en GA4",
  guardar_plan: "Guardando plan",
  guardar_resumen: "Guardando resumen",
};

export function AgenteView({ usuario, vista }: { usuario: SidebarUsuario; vista: AgenteVista }) {
  const router = useRouter();
  const sesion = vista.sesion!;
  const canal = CANAL[vista.tipo];
  const cerrada = sesion.estado === "cerrada" || vista.estadoOptimizacion === "realizada";

  const [mensajes, setMensajes] = useState<MensajeVista[]>(sesion.mensajes);
  const [plan, setPlan] = useState<ItemPlan[]>(sesion.plan);
  const [resumen, setResumen] = useState(sesion.resumenBorrador);
  const [hallazgos, setHallazgos] = useState(sesion.hallazgosBorrador);
  const [enCurso, setEnCurso] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [estadoHerramienta, setEstadoHerramienta] = useState("");
  const [error, setError] = useState("");
  const [entrada, setEntrada] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const [verContexto, setVerContexto] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const iniciadoRef = useRef(false);
  const ocupadoRef = useRef(false);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enCurso, estadoHerramienta]);

  const correr = useCallback(
    async (texto?: string) => {
      if (ocupadoRef.current) return;
      ocupadoRef.current = true;
      setTrabajando(true);
      setError("");
      setEnCurso("");
      if (texto) setMensajes((m) => [...m, { rol: "user", texto }]);
      let acumulado = "";
      try {
        const res = await fetch(`/api/agente/${sesion.id}/mensaje`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(texto ? { texto } : {}),
        });
        if (!res.ok || !res.body) throw new Error(`El servidor respondió ${res.status}`);
        const lector = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const manejar = (e: EventoAgente) => {
          if (e.type === "texto") {
            acumulado += e.delta;
            setEnCurso(acumulado);
          } else if (e.type === "herramienta") {
            setEstadoHerramienta(e.estado === "inicio" ? NOMBRE_HERRAMIENTA[e.nombre] ?? e.nombre : "");
          } else if (e.type === "plan") {
            setPlan(e.plan);
          } else if (e.type === "resumen") {
            setResumen(e.resumen);
            setHallazgos(e.hallazgos);
          } else if (e.type === "error") {
            setError(e.mensaje);
          }
        };
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let corte;
          while ((corte = buffer.indexOf("\n")) >= 0) {
            const linea = buffer.slice(0, corte).trim();
            buffer = buffer.slice(corte + 1);
            if (linea) manejar(JSON.parse(linea) as EventoAgente);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Se perdió la conexión con el agente.");
      } finally {
        if (acumulado.trim()) setMensajes((m) => [...m, { rol: "assistant", texto: acumulado.trim() }]);
        setEnCurso("");
        setEstadoHerramienta("");
        setTrabajando(false);
        ocupadoRef.current = false;
      }
    },
    [sesion.id],
  );

  // Primera vez: el único mensaje es el contexto armado por la plataforma, el agente aún no respondió.
  useEffect(() => {
    if (iniciadoRef.current || cerrada) return;
    iniciadoRef.current = true;
    if (sesion.mensajes.length === 0) queueMicrotask(() => void correr());
  }, [cerrada, correr, sesion.mensajes.length]);

  async function enviar() {
    const texto = entrada.trim();
    if (!texto || trabajando) return;
    setEntrada("");
    await correr(texto);
  }

  async function marcar(item: ItemPlan, estado: EstadoItemPlan) {
    const nuevo = item.estado === estado ? "pendiente" : estado;
    setPlan((p) => p.map((it) => (it.id === item.id ? { ...it, estado: nuevo } : it)));
    const r = await actualizarEstadoItemPlan(sesion.id, item.id, nuevo);
    if (!r.ok) setPlan((p) => p.map((it) => (it.id === item.id ? { ...it, estado: item.estado } : it)));
  }

  async function cerrar() {
    if (!confirm("Se escribirá el resumen en la bitácora, se marcará la optimización como realizada y se programará la de la próxima semana. ¿Cerrar?")) return;
    setCerrando(true);
    setErrorCierre("");
    const r = await cerrarOptimizacionConAgente({ sessionId: sesion.id, resumen, hallazgos });
    setCerrando(false);
    if (!r.ok) {
      setErrorCierre(r.error ?? "No se pudo cerrar.");
      return;
    }
    router.refresh();
  }

  const abiertos = plan.filter((p) => p.estado === "pendiente").length;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="calendario" usuario={usuario} />

      <main className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href={`/optimizaciones/bloque/${vista.fechaProgramada}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Bloque
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">{vista.clienteNombre}</span>
          <span className="rounded-full px-2 py-px text-[10.5px] font-semibold" style={{ color: canal.color, background: canal.bg }}>
            {canal.label}
          </span>
          <span className="ml-auto text-[12px] text-muted-2">{fmtFecha(vista.fechaProgramada)}</span>
          {cerrada && <span className="rounded-full bg-success-bg px-2.5 py-1 text-[11.5px] font-semibold text-success">Cerrada</span>}
        </header>

        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(320px,1fr)" }}>
          {/* Chat */}
          <section className="flex min-h-0 flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto px-[26px] py-5">
              <div className="mb-4 rounded-[10px] border border-border-soft bg-surface px-3.5 py-2.5 text-[12px] text-muted">
                <button onClick={() => setVerContexto((v) => !v)} className="font-semibold text-ink">
                  Contexto cargado: {sesion.historialPrevio} optimización(es) anterior(es) {verContexto ? "▲" : "▼"}
                </button>
                {sesion.historialPrevio < sesion.minHistorial && (
                  <span className="ml-2 font-semibold text-warning">Hay menos de {sesion.minHistorial} en el historial.</span>
                )}
                {verContexto && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed">{sesion.contexto}</pre>}
              </div>

              <div className="flex flex-col gap-3">
                {mensajes.map((m, i) => (
                  <Burbuja key={i} rol={m.rol} texto={m.texto} />
                ))}
                {enCurso && <Burbuja rol="assistant" texto={enCurso} />}
                {trabajando && (
                  <div className="text-[12px] italic text-muted-2">{estadoHerramienta || (enCurso ? "Escribiendo…" : "Pensando…")}</div>
                )}
                {error && <div className="rounded-lg bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{error}</div>}
                <div ref={finRef} />
              </div>
            </div>

            <div className="flex-none border-t border-border bg-surface p-3.5">
              <div className="flex items-end gap-2">
                <textarea
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                  rows={2}
                  disabled={cerrada}
                  placeholder={cerrada ? "La optimización está cerrada." : "Escríbele al agente: ajusta el plan, pide un análisis, redacta un copy…"}
                  className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
                />
                <button onClick={() => void enviar()} disabled={cerrada || trabajando || !entrada.trim()} className="btn-primary rounded-lg border-none bg-accent px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60">
                  Enviar
                </button>
              </div>
            </div>
          </section>

          {/* Plan + cierre */}
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-canvas px-[22px] py-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-faint [letter-spacing:.03em]">Plan de la semana</span>
                {plan.length > 0 && <span className="text-[11.5px] text-muted-2">{abiertos} abierto(s) de {plan.length}</span>}
              </div>
              {plan.length === 0 ? (
                <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-2">
                  Cuando el agente termine la auditoría, el plan priorizado aparece aquí.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {plan.map((it) => (
                    <div key={it.id} className="rounded-[12px] border border-border bg-surface p-3" style={{ opacity: it.estado === "pendiente" ? 1 : 0.6 }}>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full" style={{ background: PRIORIDAD_COLOR[it.prioridad] }} title={`Prioridad ${it.prioridad}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold" style={{ textDecoration: it.estado === "pendiente" ? undefined : "line-through" }}>
                            {it.titulo}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold text-muted-2">
                            <span className="rounded-full bg-border-soft px-1.5 py-px">{TIPO_ITEM_LABEL[it.tipo]}</span>
                            <span>Prioridad {it.prioridad}</span>
                            {it.revisarEn && <span>· revisar desde {fmtFecha(it.revisarEn)}</span>}
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">{it.detalle}</p>
                        </div>
                      </div>
                      {!cerrada && (
                        <div className="mt-2 flex gap-1.5 pl-4">
                          <button onClick={() => void marcar(it, "hecha")} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${it.estado === "hecha" ? "border-success bg-success-bg text-success" : "border-border text-muted-2"}`}>
                            {it.estado === "hecha" ? "✓ Hecha" : "Marcar hecha"}
                          </button>
                          <button onClick={() => void marcar(it, "descartada")} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${it.estado === "descartada" ? "border-border bg-border-soft text-ink" : "border-border text-muted-2"}`}>
                            {it.estado === "descartada" ? "Descartada" : "Descartar"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-2">El agente solo propone: los cambios en la cuenta los haces tú y los marcas aquí. Lo que quede abierto pasa como pendiente a la próxima optimización.</p>
            </div>

            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="text-[11px] font-bold uppercase text-faint [letter-spacing:.03em]">Resumen para la bitácora</div>
              <p className="mt-1 text-[11.5px] text-muted-2">Pídele al agente que lo redacte o escríbelo tú. Esto es lo que se guarda en la bitácora del cliente.</p>
              <textarea value={resumen} onChange={(e) => setResumen(e.target.value)} disabled={cerrada} rows={6} placeholder="Qué se hizo, qué se decidió y qué queda en espera…" className="mt-2 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink disabled:opacity-60" />
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted-2">Hallazgos (opcional)</span>
                <textarea value={hallazgos} onChange={(e) => setHallazgos(e.target.value)} disabled={cerrada} rows={2} className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink disabled:opacity-60" />
              </label>
              {errorCierre && <div className="mt-2 rounded-lg bg-danger-bg px-3 py-2 text-[12px] text-danger">{errorCierre}</div>}
              {!cerrada && (
                <button onClick={() => void cerrar()} disabled={cerrando || trabajando || resumen.trim().length < 10} className="btn-primary mt-3 w-full rounded-lg border-none bg-accent px-3 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60">
                  {cerrando ? "Cerrando…" : "Cerrar optimización y enviar a bitácora"}
                </button>
              )}
              {cerrada && <p className="mt-3 text-[12px] font-semibold text-success">Optimización cerrada y registrada en la bitácora.</p>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Burbuja({ rol, texto }: { rol: "user" | "assistant"; texto: string }) {
  const esUsuario = rol === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[88%] whitespace-pre-wrap rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={esUsuario ? { background: "var(--color-accent)", color: "#fff" } : { background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {texto}
      </div>
    </div>
  );
}
