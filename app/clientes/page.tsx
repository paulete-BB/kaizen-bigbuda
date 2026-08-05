import { ClientesListView } from "@/components/clientes/ClientesListView";
import { listAjustesRecientes, listClientesResumen, listServiciosActivosConCliente } from "@/lib/data/clients";
import { listResponsables } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/server";

export default async function ClientesPage() {
  const session = await requireUser();
  const [clientes, servicios, ajustesRecientes, responsables] = await Promise.all([
    listClientesResumen(),
    listServiciosActivosConCliente(),
    listAjustesRecientes(),
    listResponsables(),
  ]);

  return (
    <ClientesListView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      clientes={clientes}
      servicios={servicios}
      ajustesRecientes={ajustesRecientes}
      responsables={responsables}
    />
  );
}
