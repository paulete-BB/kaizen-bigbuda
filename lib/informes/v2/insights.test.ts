import { describe, expect, it } from "vitest";
import { parsearInsights, parsearRespuesta } from "./insights";

describe("parsearInsights", () => {
  it("separa frases por servicio con títulos y viñetas variados", () => {
    const r = parsearInsights(`Claro, aquí van:

## SEO · AEO · GEO
- Tus clics subieron 12 % y ya son 612 al mes.
- Más gente te encuentra en Google.
* **Seguimos** con las páginas que casi llegan al top 10.

**Meta Ads**
1. Cada resultado cuesta 0,14 USD, 30 % menos.
2) La campaña de ventas rinde mejor.
• Probamos creativos nuevos.

### Google Ads:
- Solo una frase.`);
    expect(r.seo).toEqual(["Tus clics subieron 12 % y ya son 612 al mes.", "Más gente te encuentra en Google.", "Seguimos con las páginas que casi llegan al top 10."]);
    expect(r.meta).toHaveLength(3);
    expect(r.googleAds).toEqual(["Solo una frase."]);
  });

  it("ignora viñetas antes de cualquier título y los marcadores de ejemplo", () => {
    const r = parsearInsights(`- suelta\n## Meta Ads\n- (frase 1)\n- Real.`);
    expect(r.meta).toEqual(["Real."]);
  });
});

describe("parsearRespuesta", () => {
  it("separa también lo que hicimos y lo que viene", () => {
    const r = parsearRespuesta(`## Meta Ads
- Una.
- Dos.
- Tres.

## Lo que hicimos
- Ajustamos la segmentación.
- Probamos creativos nuevos.

**Lo que viene**
1. Subir presupuesto a lo que convierte.
2. Revisar palabras clave negativas.`);
    expect(r.insights.meta).toHaveLength(3);
    expect(r.hechos).toEqual(["Ajustamos la segmentación.", "Probamos creativos nuevos."]);
    expect(r.proximos).toEqual(["Subir presupuesto a lo que convierte.", "Revisar palabras clave negativas."]);
  });
});
