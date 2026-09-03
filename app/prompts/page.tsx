import { PromptsListView } from "@/components/prompts/PromptsListView";
import { listarPrompts, CATEGORIAS_PROMPT, type PromptCategoria } from "@/lib/data/prompts";
import { requireUser } from "@/lib/auth/server";

export default async function PromptsPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const session = await requireUser();
  const params = await searchParams;
  const q = params.q ?? "";
  const categoriaParam = params.categoria ?? "";
  const categoria = (CATEGORIAS_PROMPT as readonly string[]).includes(categoriaParam) ? (categoriaParam as PromptCategoria) : "";

  const prompts = await listarPrompts({ categoria: categoria || undefined, q: q || undefined });

  return (
    <PromptsListView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      prompts={prompts}
      q={q}
      categoria={categoria}
    />
  );
}
