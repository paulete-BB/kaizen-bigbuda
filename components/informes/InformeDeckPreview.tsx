"use client";

import { InformeDeck } from "@/components/informes/InformeDeck";

const ANCHO_SLIDE = 1920;
const ALTO_SLIDE = 1080;
const ESCALA = 0.26;

/** Vista previa a escala del deck completo (todas las slides apiladas) — mismo componente que usa la ruta de impresión, solo envuelto en un `transform: scale()`. */
export function InformeDeckPreview({ slidesHtml }: { slidesHtml: string[] }) {
  const alto = slidesHtml.length * ALTO_SLIDE * ESCALA;
  const ancho = ANCHO_SLIDE * ESCALA;

  return (
    <div style={{ width: ancho, height: alto, overflow: "hidden" }}>
      <div style={{ width: ANCHO_SLIDE, transform: `scale(${ESCALA})`, transformOrigin: "top left" }}>
        <InformeDeck slidesHtml={slidesHtml} />
      </div>
    </div>
  );
}
