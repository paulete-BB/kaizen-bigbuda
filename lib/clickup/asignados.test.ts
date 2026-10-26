import { describe, expect, it } from "vitest";
import { calcularCambioAsignados } from "./asignados";

describe("calcularCambioAsignados", () => {
  it("agrega al responsable si la tarea no tiene a nadie", () => {
    expect(calcularCambioAsignados([], 10)).toEqual({ add: [10], rem: [] });
  });
  it("no cambia nada si ya es el único asignado", () => {
    expect(calcularCambioAsignados([10], 10)).toEqual({ add: [], rem: [] });
  });
  it("reemplaza al responsable anterior", () => {
    expect(calcularCambioAsignados([20], 10)).toEqual({ add: [10], rem: [20] });
  });
  it("quita a los demás si el responsable ya estaba junto a otros", () => {
    expect(calcularCambioAsignados([10, 20, 30], 10)).toEqual({ add: [], rem: [20, 30] });
  });
});
