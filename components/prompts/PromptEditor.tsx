"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editarPrompt, eliminarPrompt } from "@/lib/data/prompts-actions";
import type { PromptDetalle } from "@/lib/data/prompts";
import { CATEGORIAS_PROMPT } from "@/lib/prompts-categorias";

export function PromptEditor({ prompt, esAdmin }: { prompt: PromptDetalle; esAdmin: boolean }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(prompt.titulo);
  const [categoria, setCategoria] = useState(prompt.categoria);
  const [tags, setTags] = useState(prompt.tags.join(", "));
  const [herramienta, setHerramienta] = useState(prompt.herramienta ?? "");
  const [contenido, setContenido] = useState(prompt.contenido);
  const [notas, setNotas] = useState(prompt.notas ?? "");
  const [pending, setPending] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [versionGuardada, setVersionGuardada] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setPending(true);
    setError(null);
    setVersionGuardada(null);
    const fd = new FormData();
    fd.set("id", prompt.id);
    fd.set("titulo", titulo);
    fd.set("categoria", categoria);
    fd.set("tags", tags);
    fd.set("herramienta", herramienta);
    fd.set("contenido", contenido);
    fd.set("notas", notas);
    try {
      const res = await editarPrompt(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      // El número de versión viene de la respuesta de la acción, no de `prompt.version + 1`:
      // `router.refresh()` puede actualizar la prop `prompt` (ya con el nuevo valor) antes de
      // este render, lo que haría que "+1" sume sobre un valor que ya es el nuevo.
      setVersionGuardada(res.version ?? null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${prompt.titulo}"? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    const fd = new FormData();
    fd.set("id", prompt.id);
    try {
      const res = await eliminarPrompt(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar.");
        setEliminando(false);
        return;
      }
      router.push("/prompts");
    } catch {
      setEliminando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-5">
      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Título</span>
        <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setVersionGuardada(null); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink" />
      </label>

      <div className="flex gap-2.5">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Categoría</span>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value as typeof categoria); setVersionGuardada(null); }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink"
          >
            {CATEGORIAS_PROMPT.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-2">Herramienta destino</span>
          <input
            value={herramienta}
            onChange={(e) => { setHerramienta(e.target.value); setVersionGuardada(null); }}
            placeholder="Claude, ChatGPT…"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Sub-etiquetas (separadas por coma)</span>
        <input value={tags} onChange={(e) => { setTags(e.target.value); setVersionGuardada(null); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">
          Contenido — admite <code>{"{{cliente}}"}</code>, <code>{"{{url}}"}</code>, <code>{"{{mes}}"}</code>
        </span>
        <textarea
          value={contenido}
          onChange={(e) => { setContenido(e.target.value); setVersionGuardada(null); }}
          rows={14}
          className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] text-ink"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Notas de uso</span>
        <textarea value={notas} onChange={(e) => { setNotas(e.target.value); setVersionGuardada(null); }} rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={pending} className="btn-primary rounded-lg border-none bg-accent px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {versionGuardada !== null && <span className="text-[12px] font-semibold text-success">Guardado — versión {versionGuardada}.</span>}
        <div className="flex-1" />
        {esAdmin && (
          <button onClick={eliminar} disabled={eliminando} className="text-[11.5px] font-semibold text-danger disabled:opacity-60">
            {eliminando ? "Eliminando…" : "Eliminar prompt"}
          </button>
        )}
      </div>
    </div>
  );
}
