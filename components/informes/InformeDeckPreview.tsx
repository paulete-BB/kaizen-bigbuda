"use client";

import { InformeDeck } from "@/components/informes/InformeDeck";

const ANCHO_SLIDE = 1920;
const ALTO_SLIDE = 1080;
const ESCALA = 0.26;
const ESCALA_V2 = 0.3;

/** Vista previa a escala del deck completo (todas las slides apiladas) — mismo componente que usa la ruta de impresión, solo envuelto en un `transform: scale()`. */
export function InformeDeckPreview({ slidesHtml, variante }: { slidesHtml: string[]; variante?: "v2" }) {
  const escala = variante === "v2" ? ESCALA_V2 : ESCALA;
  const alto = slidesHtml.length * ALTO_SLIDE * escala;
  const ancho = ANCHO_SLIDE * escala;

  return (
    <div style={{ width: ancho, height: alto, overflow: "hidden" }}>
      <div style={{ width: ANCHO_SLIDE, transform: `scale(${escala})`, transformOrigin: "top left" }}>
        <InformeDeck slidesHtml={slidesHtml} variante={variante} />
      </div>
    </div>
  );
}
