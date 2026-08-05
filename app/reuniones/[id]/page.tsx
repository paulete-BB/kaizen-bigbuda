import { notFound } from "next/navigation";
import { ReunionView } from "@/components/reuniones/ReunionView";
import { getReunion } from "@/lib/data/meetings";
import { requireUser } from "@/lib/auth/server";

export default async function ReunionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();

  const reunion = await getReunion(id);
  if (!reunion) notFound();

  return (
    <ReunionView
      reunion={reunion}
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
    />
  );
}
