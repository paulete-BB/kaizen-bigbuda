import { notFound } from "next/navigation";
import { ClienteView } from "@/components/clientes/ClienteView";
import { getClienteDetalle } from "@/lib/data/cliente-detalle";
import { getBitacoraCliente } from "@/lib/data/bitacora";
import { getOnboardingCliente } from "@/lib/data/onboarding";
import { listReunionesCliente } from "@/lib/data/meetings";
import { listResponsables } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/server";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();

  const cliente = await getClienteDetalle(id);
  if (!cliente) notFound();

  const [bitacora, onboarding, reuniones, responsables] = await Promise.all([
    getBitacoraCliente(id),
    getOnboardingCliente(id),
    listReunionesCliente(id),
    listResponsables(),
  ]);

  return (
    <ClienteView
      cliente={cliente}
      bitacora={bitacora}
      onboarding={onboarding}
      reuniones={reuniones}
      responsables={responsables}
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
    />
  );
}
