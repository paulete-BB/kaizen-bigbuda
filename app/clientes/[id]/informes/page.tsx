import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getClienteDetalle } from "@/lib/data/cliente-detalle";
import { listarInformesPorCliente } from "@/lib/data/informes";
import { InformesClienteView } from "@/components/informes/InformesClienteView";

export default async function InformesClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ errorCreando?: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const { errorCreando } = await searchParams;
  const [cliente, informes] = await Promise.all([getClienteDetalle(id), listarInformesPorCliente(id)]);
  if (!cliente) notFound();

  return (
    <InformesClienteView
      cliente={cliente}
      informes={informes}
      errorCreando={errorCreando === "1"}
      usuario={{ nombre: session.nombre, iniciales: session.nombre.slice(0, 2).toUpperCase(), rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo" }}
    />
  );
}
