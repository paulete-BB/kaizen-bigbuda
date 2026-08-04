import { notFound } from "next/navigation";
import { RegistroSeoView } from "@/components/registro-seo/RegistroSeoView";
import { getRegistroSeo } from "@/lib/data/registro-seo";
import { requireUser } from "@/lib/auth/server";

export default async function RegistroSeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const registro = await getRegistroSeo(id);
  if (!registro) notFound();

  return (
    <RegistroSeoView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      registro={registro}
    />
  );
}
