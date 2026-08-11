import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { obtenerInforme } from "@/lib/data/informes";
import { renderSlidesInforme } from "@/lib/informes/render-informe";
import { InformeDeck } from "@/components/informes/InformeDeck";

export default async function ImprimirInformePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const informe = await obtenerInforme(id);
  if (!informe) notFound();

  const slidesHtml = renderSlidesInforme(informe);

  return (
    <div style={{ background: "#0a0a0a" }}>
      <div
        className="informe-noprint"
        style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", gap: 12, alignItems: "center", padding: "14px 24px", background: "#151515", color: "#efece5", fontFamily: "system-ui, sans-serif", fontSize: 13 }}
      >
        <Link href={`/informes/${id}`} style={{ color: "#e8b06e" }}>
          ← Volver al editor
        </Link>
        <span style={{ color: "#8a857c" }}>Usa Ctrl/Cmd+P → Guardar como PDF (apaisado) para exportar este informe.</span>
      </div>
      <InformeDeck slidesHtml={slidesHtml} />
    </div>
  );
}
