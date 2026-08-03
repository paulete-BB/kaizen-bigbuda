"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tarea, TareaDestino } from "@/lib/clientes/types";
import { PERSONAS, SERVICIO_TAREA_OPTS } from "@/lib/clientes/mock";

const RESPONSABLES = Object.entries(PERSONAS) as [keyof typeof PERSONAS, (typeof PERSONAS)[keyof typeof PERSONAS]][];
const FRECUENCIAS = ["Cada mes", "Cada optimización", "Cada 3 meses", "Cada 6 meses"];

interface TareasPanelProps {
  tareas: Tarea[];
  clienteId: string;
  proximaOptimizacion: string;
  permitirRecurrentes?: boolean;
  onLogCambio: (titulo: string, desc: string, tipo: string) => void;
}

export function TareasPanel({
  tareas: tareasIniciales,
  clienteId,
  proximaOptimizacion,
  permitirRecurrentes = true,
  onLogCambio,
}: TareasPanelProps) {
  const [tareas, setTareas] = useState(tareasIniciales);
  const [titulo, setTitulo] = useState("");
  const [destino, setDestino] = useState<TareaDestino>("checklist");
  const [frecuencia, setFrecuencia] = useState(FRECUENCIAS[0]);
  const [servicio, setServicio] = useState<Tarea["svc"]>("seo");
  const [responsable, setResponsable] = useState<Tarea["who"]>("MA");

  const destinoActivo = permitirRecurrentes ? destino : "checklist";
  const enChecklist = tareas.filter((t) => t.destino === "checklist").length;
  const recurrentes = tareas.length - enChecklist;

  function addTarea() {
    const t = titulo.trim();
    if (!t) return;
    setTareas((prev) => [
      { id: `t${Date.now()}`, titulo: t, destino: destinoActivo, frecuencia, svc: servicio, who: responsable },
      ...prev,
    ]);
    setTitulo("");
    onLogCambio(
      `Tarea agregada · ${t}`,
      destinoActivo === "checklist"
        ? `Queda en el checklist de la próxima optimización (${proximaOptimizacion}).`
        : `Queda como tarea recurrente · ${frecuencia}.`,
      destinoActivo === "checklist" ? "Checklist" : "Recurrente",
    );
  }

  function removeTarea(id: string) {
    setTareas((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface" style={{ borderTop: "3px solid var(--color-accent)" }}>
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-[15px]">
        <div className="flex items-center gap-2.5">
          <span className="text-[14.5px] font-bold">Tareas a revisar</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-soft-ink">
            {tareas.length}
          </span>
        </div>
        <span className="text-[12px] font-medium text-muted-2">Próxima optimización · {proximaOptimizacion}</span>
      </div>

      <div className="flex flex-col gap-[11px] border-b border-border-soft bg-[#fdfbf7] px-5 py-4">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTarea();
          }}
          placeholder="Ej. Revisar canibalización de keywords en fichas de filtros"
          className="w-full rounded-[9px] border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink"
        />
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Dónde queda</span>
            <div className="flex overflow-hidden rounded-[9px] border border-border bg-surface">
              <button
                onClick={() => setDestino("checklist")}
                className="border-r border-border px-[13px] py-2.5 font-sans text-[12.5px] font-semibold"
                style={{
                  background: destinoActivo === "checklist" ? "var(--color-accent-soft)" : "var(--color-surface)",
                  color: destinoActivo === "checklist" ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                }}
              >
                Checklist {proximaOptimizacion}
              </button>
              {permitirRecurrentes && (
                <button
                  onClick={() => setDestino("recurrente")}
                  className="px-[13px] py-2.5 font-sans text-[12.5px] font-semibold"
                  style={{
                    background: destinoActivo === "recurrente" ? "var(--color-accent-soft)" : "var(--color-surface)",
                    color: destinoActivo === "recurrente" ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                  }}
                >
                  Tarea recurrente
                </button>
              )}
            </div>
          </div>
          {destinoActivo === "recurrente" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted-2">Frecuencia</span>
              <select
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value)}
                className="rounded-[9px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Servicio</span>
            <div className="flex overflow-hidden rounded-[9px] border border-border bg-surface">
              {(Object.keys(SERVICIO_TAREA_OPTS) as (keyof typeof SERVICIO_TAREA_OPTS)[]).map((key) => {
                const on = servicio === key;
                const opt = SERVICIO_TAREA_OPTS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setServicio(key)}
                    className="flex items-center gap-1.5 border-r border-border px-3 py-2.5 font-sans text-[12.5px] font-semibold last:border-r-0"
                    style={{
                      background: on ? "var(--color-accent-soft)" : "var(--color-surface)",
                      color: on ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: opt.color }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Responsable</span>
            <select
              value={responsable}
              onChange={(e) => setResponsable(e.target.value as Tarea["who"])}
              className="rounded-[9px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink"
            >
              {RESPONSABLES.map(([key, p]) => (
                <option key={key} value={key}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={addTarea}
            className="btn-primary rounded-[9px] border-none bg-accent px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white"
          >
            Agregar tarea
          </button>
        </div>
        <div className="text-[11.5px] text-muted-2">
          {destinoActivo === "checklist"
            ? `Se agrega al checklist de la optimización del ${proximaOptimizacion} y aparece en el registro de ese día.`
            : `Se repite ${frecuencia.toLowerCase()} en el checklist de cada optimización, hasta que la desactives.`}
        </div>
      </div>

      <div className="px-5 pb-3 pt-1.5">
        {tareas.map((t) => {
          const opt = SERVICIO_TAREA_OPTS[t.svc];
          const persona = PERSONAS[t.who];
          const badge = t.destino === "checklist" ? `Checklist ${proximaOptimizacion}` : `Recurrente · ${(t.frecuencia ?? "Cada mes").toLowerCase()}`;
          return (
            <div key={t.id} className="editrow flex items-start gap-3 border-b border-border-soft-2 py-[13px]">
              <span className="mt-0.5 h-[18px] w-[18px] flex-none rounded-[5px] border-[1.8px] border-[#cdd3db]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold" style={{ textWrap: "pretty" }}>
                  {t.titulo}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{
                      color: t.destino === "checklist" ? "var(--color-accent-soft-ink)" : "#0f766e",
                      background: t.destino === "checklist" ? "var(--color-accent-soft)" : "#e2f4f1",
                    }}
                  >
                    {badge}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-2">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: opt.color }} />
                    {opt.label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-2">
                    <span
                      className="flex h-[17px] w-[17px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ background: persona.color }}
                    >
                      {t.who}
                    </span>
                    {persona.nombre}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeTarea(t.id)}
                className="xbtn flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border-none bg-transparent text-faint"
                title="Quitar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-border-soft bg-hover-2 px-5 py-3">
        <span className="text-[11.5px] text-muted-2">
          {enChecklist} en el checklist del {proximaOptimizacion} · {recurrentes} recurrentes
        </span>
        <Link href={`/clientes/${clienteId}/registro-seo`} className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          Abrir checklist
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
