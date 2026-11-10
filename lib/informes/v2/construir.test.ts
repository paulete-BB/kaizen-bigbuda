import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ sql: vi.fn() }));
vi.mock("@/lib/data/resultados", () => ({ obtenerResultadosPeriodo: vi.fn() }));

import { periodoDelInforme, periodoPersonalizado } from "./construir";

const hoy = new Date(2026, 10, 10); // 10 de noviembre de 2026

describe("periodoDelInforme", () => {
  it("un mes cerrado va del 1 al último día y se compara con el mes anterior completo", () => {
    const p = periodoDelInforme(10, 2026, hoy);
    expect([p.desde, p.hasta]).toEqual(["2026-10-01", "2026-10-31"]);
    expect([p.anteriorDesde, p.anteriorHasta]).toEqual(["2026-09-01", "2026-09-30"]);
    expect(p.personalizado).toBeUndefined();
  });

  it("el mes en curso va del 1 a hoy contra los mismos días del mes anterior", () => {
    const p = periodoDelInforme(11, 2026, hoy);
    expect([p.desde, p.hasta]).toEqual(["2026-11-01", "2026-11-10"]);
    expect([p.anteriorDesde, p.anteriorHasta]).toEqual(["2026-10-01", "2026-10-10"]);
  });

  it("enero se compara con diciembre del año anterior", () => {
    const p = periodoDelInforme(1, 2026, hoy);
    expect([p.anteriorDesde, p.anteriorHasta]).toEqual(["2025-12-01", "2025-12-31"]);
  });
});

describe("periodoPersonalizado", () => {
  it("compara contra el período de igual largo inmediatamente anterior", () => {
    const p = periodoPersonalizado("2026-10-15", "2026-10-21", hoy)!;
    expect([p.anteriorDesde, p.anteriorHasta]).toEqual(["2026-10-08", "2026-10-14"]);
    expect(p.personalizado).toBe(true);
  });

  it("rechaza fechas inválidas, invertidas, futuras o demasiado largas", () => {
    expect(periodoPersonalizado("2026-10-21", "2026-10-15", hoy)).toBeNull();
    expect(periodoPersonalizado("2026-11-01", "2026-11-30", hoy)).toBeNull();
    expect(periodoPersonalizado("2025-01-01", "2026-10-31", hoy)).toBeNull();
    expect(periodoPersonalizado("hola", "2026-10-31", hoy)).toBeNull();
  });
});
