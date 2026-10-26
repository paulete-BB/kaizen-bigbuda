import { describe, expect, it } from "vitest";
import { fechasSemanalesAds, limitesSemana } from "./ads-semanal";

describe("fechasSemanalesAds", () => {
  // lunes 26 oct 2026
  it("incluye hoy si hoy es su día y cubre 4 semanas más", () => {
    expect(fechasSemanalesAds("2026-10-26", 1)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  });
  it("salta el día de esta semana si ya pasó", () => {
    // martes 27: el lunes de esta semana ya pasó, parte la semana siguiente
    expect(fechasSemanalesAds("2026-10-27", 1)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  });
  it("viernes asignado desde un lunes (el del 27 nov queda fuera de las 4 semanas)", () => {
    expect(fechasSemanalesAds("2026-10-26", 5)).toEqual(["2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20"]);
  });
  it("trabaja bien un domingo (la semana ya terminó)", () => {
    expect(fechasSemanalesAds("2026-11-01", 3)).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
  });
  it("día inválido no genera nada", () => {
    expect(fechasSemanalesAds("2026-10-26", 0)).toEqual([]);
    expect(fechasSemanalesAds("2026-10-26", 6)).toEqual([]);
  });
});

describe("limitesSemana", () => {
  it("devuelve lunes y domingo", () => {
    expect(limitesSemana("2026-10-29")).toEqual({ lunes: "2026-10-26", domingo: "2026-11-01" });
    expect(limitesSemana("2026-11-01")).toEqual({ lunes: "2026-10-26", domingo: "2026-11-01" });
  });
});
