"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import type { ClienteDetalleCompleto, ServicioTipo } from "@/lib/data/cliente-detalle";
import type { InformeResumen } from "@/lib/data/informes";
import { crearInforme } from "@/lib/data/informes-actions";
import { fmtMesAnio } from "@/lib/informes/tipos";

const TIPO_LABEL: Record<ServicioTipo, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

const ESTADO_LABEL: Record<InformeResumen["estado"], string> = {
  borrador: "Borrador",
  listo: "Listo",
  enviado: "Enviado",
};

const ESTADO_CLASE: Record<InformeResumen["estado"], string> = {
  borrador: "bg-hover text-muted",
  listo: "bg-warning-bg text-warning",
  enviado: "bg-success-bg text-success",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function InformesClienteView({
  cliente,
  informes,
  usuario,
}: {
  cliente: ClienteDetalleCompleto;
  informes: InformeResumen[];
  usuario: SidebarUsuario;
}) {
  const tiposDisponibles = cliente.serviciosTiposExistentes;
  const hoy = new Date();
  const [tipo, setTipo] = useState<ServicioTipo | "">(tiposDisponibles[0] ?? "");
  const [periodoMes, setPeriodoMes] = useState(hoy.getMonth() + 1);
  const [periodoAnio, setPeriodoAnio] = useState(hoy.getFullYear());
  const [duplicarDeId, setDuplicarDeId] = useState("");
  const [creando, setCreando] = useState(false);

  const informesDelTipo = useMemo(() => informes.filter((r) => r.tipo === tipo), [informes, tipo]);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href={`/clientes/${cliente.id}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {cliente.nombre}
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">Informes</span>
        </header>

        <div className="flex w-full max-w-[900px] flex-col gap-6 px-[26px] pb-10 pt-[22px]">
          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="mb-4 text-[14.5px] font-bold">Nuevo informe</div>
            {tiposDisponibles.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">Este cliente no tiene servicios activos.</p>
            ) : (
              <form
                action={crearInforme}
                onSubmit={() => setCreando(true)}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="clientId" value={cliente.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Servicio</span>
                  <select
                    name="tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as ServicioTipo)}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                  >
                    {tiposDisponibles.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Mes</span>
                  <select
                    name="periodoMes"
                    value={periodoMes}
                    onChange={(e) => setPeriodoMes(Number(e.target.value))}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                  >
                    {MESES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Año</span>
                  <input
                    type="number"
                    name="periodoAnio"
                    value={periodoAnio}
                    onChange={(e) => setPeriodoAnio(Number(e.target.value))}
                    className="w-24 rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                  />
                </label>
                {informesDelTipo.length > 0 && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-semibold text-muted-2">Duplicar desde</span>
                    <select
                      name="duplicarDeId"
                      value={duplicarDeId}
                      onChange={(e) => setDuplicarDeId(e.target.value)}
                      className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
                    >
                      <option value="">En blanco</option>
                      {informesDelTipo.map((r) => (
                        <option key={r.id} value={r.id}>
                          {fmtMesAnio(r.periodoMes, r.periodoAnio)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="submit" disabled={creando} className="btn-primary rounded-lg border-none bg-accent px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
                  {creando ? "Creando…" : "Crear borrador"}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="mb-4 text-[14.5px] font-bold">Historial</div>
            {informes.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">Todavía no hay informes para este cliente.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {informes.map((r) => (
                  <Link
                    key={r.id}
                    href={`/informes/${r.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] hover:bg-hover-2"
                  >
                    <span className="w-40 font-semibold text-ink">{fmtMesAnio(r.periodoMes, r.periodoAnio)}</span>
                    <span className="flex-1 text-muted-2">{TIPO_LABEL[r.tipo]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_CLASE[r.estado]}`}>{ESTADO_LABEL[r.estado]}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
