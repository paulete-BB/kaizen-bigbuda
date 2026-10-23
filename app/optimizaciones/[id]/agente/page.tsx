import { notFound, redirect } from "next/navigation";
import { AgenteView } from "@/components/agente/AgenteView";
import { getAgenteVista } from "@/lib/data/agente";
import { requireUser } from "@/lib/auth/server";

export default async function AgentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const vista = await getAgenteVista(id);
  if (!vista) notFound();
  // Sin sesión todavía: se crea desde el botón "Iniciar optimización" (acción de servidor), no al abrir la URL.
  if (!vista.sesion) redirect(`/optimizaciones/bloque/${vista.fechaProgramada}`);

  return (
    <AgenteView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      vista={vista}
    />
  );
}
