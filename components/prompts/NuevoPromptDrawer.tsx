"use client";

import { useState } from "react";
import { crearPrompt } from "@/lib/data/prompts-actions";
import { CATEGORIAS_PROMPT } from "@/lib/prompts-categorias";

export function NuevoPromptDrawer() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await crearPrompt(formData);
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
        Nuevo prompt
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[460px] flex-col gap-4 overflow-y-auto bg-surface p-6"
            style={{ borderTop: "3px solid var(--color-accent)" }}
          >
            <div>
              <div className="text-[16px] font-bold">Nuevo prompt</div>
              <div className="text-[12.5px] text-muted-2">
                Usa <code>{"{{cliente}}"}</code>, <code>{"{{url}}"}</code> y <code>{"{{mes}}"}</code> en el contenido — se
                resuelven al copiar desde la ficha del prompt.
              </div>
            </div>

            <form action={onSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Título</span>
                <input name="titulo" required className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <div className="flex gap-2.5">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Categoría</span>
                  <select name="categoria" required defaultValue="" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink">
                    <option value="" disabled>
                      Elegir…
                    </option>
                    {CATEGORIAS_PROMPT.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-muted-2">Herramienta destino (opcional)</span>
                  <input name="herramienta" placeholder="Claude, ChatGPT…" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Sub-etiquetas (separadas por coma, opcional)</span>
                <input name="tags" placeholder="keywords, técnico, onboarding" className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Contenido del prompt</span>
                <textarea
                  name="contenido"
                  required
                  rows={10}
                  className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] text-ink"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-muted-2">Notas de uso (opcional)</span>
                <textarea name="notas" rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
              </label>

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary rounded-lg border-none bg-accent px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Creando…" : "Crear prompt"}
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
