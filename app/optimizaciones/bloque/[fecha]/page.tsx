import { BloqueView } from "@/components/bloque/BloqueView";
import { getBloqueMiercoles } from "@/lib/data/bloque";
import { requireUser } from "@/lib/auth/server";

export default async function BloquePage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  const session = await requireUser();
  const items = await getBloqueMiercoles(fecha);

  return (
    <BloqueView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      fecha={fecha}
      items={items}
    />
  );
}
