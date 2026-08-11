import { ESTILOS_INFORME } from "@/lib/informes/render";

/** Renderiza el deck crudo (slides ya armados como HTML) — compartido por la vista previa del editor y la ruta de impresión. Ver lib/informes/render.ts sobre por qué es HTML crudo y no JSX. */
export function InformeDeck({ slidesHtml }: { slidesHtml: string[] }) {
  return (
    <div className="informe-canvas" style={{ display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_INFORME }} />
      <div dangerouslySetInnerHTML={{ __html: slidesHtml.join("") }} />
    </div>
  );
}
