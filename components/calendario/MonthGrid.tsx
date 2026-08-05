"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EventoCalendario, HolidayMes, ReunionCalendario } from "@/lib/data/calendario";
import { reasignarViernesSeo } from "@/lib/data/calendario-actions";
import { buildMonthGrid, toIso, hoySantiago } from "@/lib/dates";
import { fridaysOfMonth } from "@/lib/scheduling/dates";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPO_LABEL: Record<string, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export function MonthGrid({
  year,
  month,
  eventos,
  holidays,
  reuniones,
}: {
  year: number;
  month: number;
  eventos: EventoCalendario[];
  holidays: HolidayMes[];
  reuniones: ReunionCalendario[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dragServiceId, setDragServiceId] = useState<string | null>(null);

  const dias = buildMonthGrid(year, month);
  const hoyIso = toIso(hoySantiago());
  const holidayPorFecha = new Map(holidays.map((h) => [h.fecha, h.nombre]));
  const eventosPorFecha = new Map<string, EventoCalendario[]>();
  for (const e of eventos) {
    const arr = eventosPorFecha.get(e.fecha) ?? [];
    arr.push(e);
    eventosPorFecha.set(e.fecha, arr);
  }
  const reunionesPorFecha = new Map<string, ReunionCalendario[]>();
  for (const r of reuniones) {
    const arr = reunionesPorFecha.get(r.fecha) ?? [];
    arr.push(r);
    reunionesPorFecha.set(r.fecha, arr);
  }
  const fridays = fridaysOfMonth(year, month);

  async function onDrop(fechaDestino: string) {
    if (!dragServiceId) return;
    const ordinal = fridays.indexOf(fechaDestino) + 1;
    if (ordinal <= 0) return;
    setError(null);
    const res = await reasignarViernesSeo(dragServiceId, ordinal, year, month);
    setDragServiceId(null);
    if (!res.ok) setError(res.error ?? "No se pudo reasignar.");
    else router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      {error && (
        <div className="border-b border-danger-border bg-danger-bg px-4 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </div>
      )}
      <div className="grid grid-cols-7 border-b border-border-soft bg-hover-2">
        {DIAS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase text-muted-2 [letter-spacing:.03em]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((fecha) => {
          const enMes = fecha.slice(5, 7) === String(month).padStart(2, "0");
          const esHoy = fecha === hoyIso;
          const feriado = holidayPorFecha.get(fecha);
          const eventosDia = eventosPorFecha.get(fecha) ?? [];
          const esViernes = fridays.includes(fecha);
          const seoDia = eventosDia.filter((e) => e.tipo === "seo_aeo_geo");
          const adsDia = eventosDia.filter((e) => e.tipo !== "seo_aeo_geo");
          const reunionesDia = reunionesPorFecha.get(fecha) ?? [];
          const dayNum = Number(fecha.slice(8, 10));

          return (
            <div
              key={fecha}
              onDragOver={esViernes && enMes ? (e) => e.preventDefault() : undefined}
              onDrop={esViernes && enMes ? () => onDrop(fecha) : undefined}
              className="flex min-h-[108px] flex-col gap-1 border-b border-r border-border-soft-2 p-1.5"
              style={{ opacity: enMes ? 1 : 0.45, background: esHoy ? "var(--color-accent-soft)" : undefined }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-muted">{dayNum}</span>
                {esHoy && <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-bold text-white">HOY</span>}
              </div>
              {feriado && <div className="truncate text-[10px] font-semibold text-danger">{feriado}</div>}

              {adsDia.length > 0 && (
                <Link
                  href={`/optimizaciones/bloque/${fecha}`}
                  className="truncate rounded-md px-1.5 py-1 text-[10.5px] font-semibold"
                  style={{ background: "#e3f4f2", color: "#0d9488" }}
                >
                  Bloque Ads · {adsDia.length}
                </Link>
              )}

              {seoDia.map((e) => (
                <Link
                  key={e.id}
                  href={`/optimizaciones/${e.id}/registro`}
                  draggable={enMes}
                  onDragStart={() => setDragServiceId(e.serviceId)}
                  onDragEnd={() => setDragServiceId(null)}
                  title={`${e.clienteNombre} · ${TIPO_LABEL[e.tipo]}${e.responsable ? " · " + e.responsable : ""}`}
                  className="truncate rounded-md px-1.5 py-1 text-[10.5px] font-semibold"
                  style={{ background: "#efecfb", color: "#6d5bd6", cursor: enMes ? "grab" : "default" }}
                >
                  {e.clienteNombre}
                </Link>
              ))}

              {reunionesDia.map((r) => (
                <Link
                  key={r.id}
                  href={`/reuniones/${r.id}`}
                  title={`${r.clienteNombre} · ${r.titulo}`}
                  className="truncate rounded-md px-1.5 py-1 text-[10.5px] font-semibold"
                  style={{ background: "var(--color-border-soft)", color: "var(--color-muted)" }}
                >
                  {r.clienteNombre} · {r.titulo}
                </Link>
              ))}

              {esViernes && enMes && seoDia.length < 2 && (
                <div className="mt-auto rounded-md border border-dashed border-border px-1.5 py-1 text-center text-[10px] text-faint">
                  {seoDia.length}/2
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
