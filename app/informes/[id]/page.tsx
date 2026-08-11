import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { obtenerInforme } from "@/lib/data/informes";
import { InformeEditorSeo } from "@/components/informes/InformeEditorSeo";

export default async function InformePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const informe = await obtenerInforme(id);
  if (!informe) notFound();

  const usuario = { nombre: session.nombre, iniciales: session.nombre.slice(0, 2).toUpperCase(), rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo" };

  if (informe.tipo === "seo_aeo_geo") {
    return <InformeEditorSeo informe={informe} usuario={usuario} />;
  }

  return (
    <div className="p-10 text-[13px] text-muted-2">
      El editor del formato de campañas (Meta/Google Ads) todavía no está implementado.
    </div>
  );
}
