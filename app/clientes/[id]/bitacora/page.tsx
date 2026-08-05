import { notFound } from "next/navigation";
import { BitacoraCompletaView } from "@/components/bitacora/BitacoraCompletaView";
import { getBitacoraCompleta, listClientesSimple } from "@/lib/data/bitacora-completa";
import { requireUser } from "@/lib/auth/server";

export default async function BitacoraClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const data = await getBitacoraCompleta(id);
  if (!data) notFound();
  const clientes = await listClientesSimple();

  return (
    <BitacoraCompletaView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      data={data}
      clientes={clientes}
    />
  );
}
