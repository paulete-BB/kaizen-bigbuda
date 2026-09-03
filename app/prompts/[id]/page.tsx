import { notFound } from "next/navigation";
import { PromptDetalleView } from "@/components/prompts/PromptDetalleView";
import { getPrompt, getVersionesPrompt, listarClientesParaVariables } from "@/lib/data/prompts";
import { requireUser } from "@/lib/auth/server";

export default async function PromptDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const prompt = await getPrompt(id);
  if (!prompt) notFound();

  const [versiones, clientes] = await Promise.all([getVersionesPrompt(id), listarClientesParaVariables()]);

  return (
    <PromptDetalleView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      prompt={prompt}
      versiones={versiones}
      clientes={clientes}
      esAdmin={session.rol === "admin"}
    />
  );
}
