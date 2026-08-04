import { ClienteView } from "@/components/clientes/ClienteView";
import { getClienteMock } from "@/lib/clientes/mock";
import { requireUser } from "@/lib/auth/server";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const cliente = getClienteMock(id);

  return (
    <ClienteView
      cliente={cliente}
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
    />
  );
}
