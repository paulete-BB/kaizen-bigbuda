import { describe, expect, it } from "vitest";
import { calcularRangosResultados, etiquetaRango, parsearRango } from "./resultados-rango";

describe("parsearRango", () => {
  it("acepta los rangos válidos y 'mes'", () => {
    expect(parsearRango("7")).toBe(7);
    expect(parsearRango("14")).toBe(14);
    expect(parsearRango("90")).toBe(90);
    expect(parsearRango("mes")).toBe("mes");
  });
  it("cae a 28 días con valores inválidos o ausentes", () => {
    expect(parsearRango(undefined)).toBe(28);
    expect(parsearRango("5")).toBe(28);
    expect(parsearRango("abc")).toBe(28);
  });
});

describe("etiquetaRango", () => {
  it("rotula días y este mes", () => {
    expect(etiquetaRango(7)).toBe("7d");
    expect(etiquetaRango("mes")).toBe("Este mes");
  });
});

describe("calcularRangosResultados", () => {
  it("7 días: ventana de 7 días terminando hoy y la ventana anterior del mismo largo", () => {
    const r = calcularRangosResultados(7, "2026-11-05");
    expect(r.actual).toEqual({ desde: "2026-10-30", hasta: "2026-11-05" });
    expect(r.anterior).toEqual({ desde: "2026-10-23", hasta: "2026-10-29" });
  });
  it("28 días como siempre", () => {
    const r = calcularRangosResultados(28, "2026-11-05");
    expect(r.actual).toEqual({ desde: "2026-10-09", hasta: "2026-11-05" });
    expect(r.anterior).toEqual({ desde: "2026-09-11", hasta: "2026-10-08" });
  });
  it("este mes: del día 1 a hoy, contra los mismos días del mes anterior", () => {
    const r = calcularRangosResultados("mes", "2026-11-05");
    expect(r.actual).toEqual({ desde: "2026-11-01", hasta: "2026-11-05" });
    expect(r.anterior).toEqual({ desde: "2026-10-01", hasta: "2026-10-05" });
  });
  it("este mes el día 1: un solo día contra el día 1 del mes anterior", () => {
    const r = calcularRangosResultados("mes", "2026-11-01");
    expect(r.actual).toEqual({ desde: "2026-11-01", hasta: "2026-11-01" });
    expect(r.anterior).toEqual({ desde: "2026-10-01", hasta: "2026-10-01" });
  });
  it("este mes cuando el mes anterior es más corto: no se pasa del último día", () => {
    const r = calcularRangosResultados("mes", "2026-03-31");
    expect(r.actual).toEqual({ desde: "2026-03-01", hasta: "2026-03-31" });
    expect(r.anterior).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });
  it("este mes cruzando el año", () => {
    const r = calcularRangosResultados("mes", "2027-01-10");
    expect(r.anterior).toEqual({ desde: "2026-12-01", hasta: "2026-12-10" });
  });
});
