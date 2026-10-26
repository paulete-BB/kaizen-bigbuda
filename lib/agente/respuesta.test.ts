import { describe, expect, it } from "vitest";
import { parsearRespuestaClaude } from "./respuesta";

const OK = `Listo, esto fue lo que hice.

## RESUMEN
Pausé 2 anuncios con CTR bajo y subí 10% el presupuesto de la campaña A.

## HALLAZGOS
El CPA de B subió 30%.

## PLAN
\`\`\`json
[
  {"id":"subir-a","prioridad":"alta","tipo":"accion","titulo":"Subir presupuesto A","detalle":"+10% porque CPA estable."},
  {"id":"esperar-b","prioridad":"media","tipo":"esperar_datos","titulo":"No tocar B","detalle":"Cambio reciente.","revisarEn":"2026-11-02"}
]
\`\`\`
`;

describe("parsearRespuestaClaude", () => {
  it("lee resumen, hallazgos y plan", () => {
    const r = parsearRespuestaClaude(OK);
    if ("error" in r) throw new Error(r.error);
    expect(r.resumen).toBe("Pausé 2 anuncios con CTR bajo y subí 10% el presupuesto de la campaña A.");
    expect(r.hallazgos).toBe("El CPA de B subió 30%.");
    expect(r.plan.map((p) => p.id)).toEqual(["subir-a", "esperar-b"]);
    expect(r.plan[1].revisarEn).toBe("2026-11-02");
    expect(r.plan[0].revisarEn).toBeNull();
    expect(r.avisos).toEqual([]);
  });

  it("avisa si el JSON del plan está roto pero conserva el resumen", () => {
    const r = parsearRespuestaClaude("## RESUMEN\nHice cosas importantes.\n## PLAN\n```json\n[{oops\n```");
    if ("error" in r) throw new Error(r.error);
    expect(r.resumen).toBe("Hice cosas importantes.");
    expect(r.plan).toEqual([]);
    expect(r.avisos.length).toBe(1);
  });

  it("falla si no hay nada aprovechable", () => {
    expect("error" in parsearRespuestaClaude("hola, no sé")).toBe(true);
  });

  it("acepta solo el plan sin resumen y lo avisa", () => {
    const r = parsearRespuestaClaude('## PLAN\n```json\n{"items":[{"id":"x","prioridad":"baja","tipo":"revisar","titulo":"Revisar algo","detalle":"detalle"}]}\n```');
    if ("error" in r) throw new Error(r.error);
    expect(r.plan).toHaveLength(1);
    expect(r.avisos.some((a) => a.includes("RESUMEN"))).toBe(true);
  });
});
