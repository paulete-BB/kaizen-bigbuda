"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_PROMPT, type PromptCategoria } from "@/lib/prompts-categorias";

export function FiltrosPrompts({ q, categoria }: { q: string; categoria: PromptCategoria | "" }) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);

  // Debounce: navegar recién 300ms después de que el usuario deja de tipear, para no
  // disparar una consulta full-text por cada tecla.
  useEffect(() => {
    const id = setTimeout(() => {
      if (texto === q) return;
      const params = new URLSearchParams();
      if (texto) params.set("q", texto);
      if (categoria) params.set("categoria", categoria);
      router.push(`/prompts${params.toString() ? `?${params.toString()}` : ""}`);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function cambiarCategoria(nueva: string) {
    const params = new URLSearchParams();
    if (texto) params.set("q", texto);
    if (nueva) params.set("categoria", nueva);
    router.push(`/prompts${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-2.5">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por título, contenido o notas…"
        className="h-9 w-[280px] rounded-lg border border-border bg-surface px-3 text-[12.5px] text-ink"
      />
      <select
        value={categoria}
        onChange={(e) => cambiarCategoria(e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-[12.5px] font-semibold text-ink"
      >
        <option value="">Todas las categorías</option>
        {CATEGORIAS_PROMPT.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
