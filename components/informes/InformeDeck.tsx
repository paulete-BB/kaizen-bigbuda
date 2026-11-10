import { ESTILOS_INFORME } from "@/lib/informes/render";
import { ESTILOS_V2 } from "@/lib/informes/v2/slides";

/** Renderiza el deck crudo (slides ya armados como HTML) — compartido por la vista previa del editor y la ruta de impresión. Ver lib/informes/render.ts sobre por qué es HTML crudo y no JSX. `variante="v2"` es el informe mensual con el diseño claro. */
export function InformeDeck({ slidesHtml, variante }: { slidesHtml: string[]; variante?: "v2" }) {
  const v2 = variante === "v2";
  return (
    <div className={v2 ? "v2-canvas" : "informe-canvas"} style={{ display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: v2 ? ESTILOS_V2 : ESTILOS_INFORME }} />
      <div dangerouslySetInnerHTML={{ __html: slidesHtml.join("") }} />
    </div>
  );
}
