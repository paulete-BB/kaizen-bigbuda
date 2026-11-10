import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { obtenerInforme } from "@/lib/data/informes";
import { InformeEditorSeo } from "@/components/informes/InformeEditorSeo";
import { InformeEditorMarketing } from "@/components/informes/InformeEditorMarketing";
import { InformeEditorAdsCombinado } from "@/components/informes/InformeEditorAdsCombinado";
import { InformeEditorV2 } from "@/components/informes/InformeEditorV2";
import { esInformeV2 } from "@/lib/informes/v2/tipos";

export default async function InformePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const informe = await obtenerInforme(id);
  if (!informe) notFound();

  const usuario = { nombre: session.nombre, iniciales: session.nombre.slice(0, 2).toUpperCase(), rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo" };

  if (esInformeV2(informe.contenido)) {
    return <InformeEditorV2 informe={informe} contenidoInicial={informe.contenido} usuario={usuario} />;
  }
  if (informe.tipo === "seo_aeo_geo") {
    return <InformeEditorSeo informe={informe} usuario={usuario} />;
  }
  if (informe.tipo === "ads_combinado") {
    return <InformeEditorAdsCombinado informe={informe} usuario={usuario} />;
  }

  return <InformeEditorMarketing informe={informe} usuario={usuario} />;
}
