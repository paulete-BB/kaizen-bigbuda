import { describe, expect, it } from "vitest";
import { asignarViernesOrdinal, generarOptimizacionesSeoDelMes, MAX_SEO_POR_VIERNES } from "./seo";
import type { ServicioActivo } from "./types";

function seoServicio(id: string, ordinal?: number | null): ServicioActivo {
  return { id, clientId: `client-${id}`, tipo: "seo_aeo_geo", viernesOrdinalAsignado: ordinal ?? null };
}

describe("asignarViernesOrdinal (regla A)", () => {
  it("es estable: nunca reasigna un servicio que ya tiene ordinal", () => {
    const servicios = [seoServicio("a", 1), seoServicio("b", 1), seoServicio("c"), seoServicio("d")];
    const { asignaciones } = asignarViernesOrdinal(servicios);

    expect(asignaciones.find((x) => x.serviceId === "a")?.ordinal).toBe(1);
    expect(asignaciones.find((x) => x.serviceId === "b")?.ordinal).toBe(1);
    // "a" y "b" ya llenan el viernes 1 (máx 2) → "c" y "d" van al viernes 2
    expect(asignaciones.find((x) => x.serviceId === "c")?.ordinal).toBe(2);
    expect(asignaciones.find((x) => x.serviceId === "d")?.ordinal).toBe(2);
  });

  it("es idempotente: repetir con el mismo input ya resuelto no cambia nada", () => {
    const primera = asignarViernesOrdinal([seoServicio("a"), seoServicio("b"), seoServicio("c")]);
    const resueltos = primera.asignaciones.map((a) =>
      seoServicio(a.serviceId, a.ordinal),
    );
    const segunda = asignarViernesOrdinal(resueltos);
    expect(segunda.asignaciones).toEqual(primera.asignaciones);
  });

  it("respeta el máximo de 2 por viernes en todo momento", () => {
    const servicios = Array.from({ length: 10 }, (_, i) => seoServicio(`s${i}`));
    const { asignaciones } = asignarViernesOrdinal(servicios);
    const porOrdinal = new Map<number, number>();
    for (const a of asignaciones) porOrdinal.set(a.ordinal, (porOrdinal.get(a.ordinal) ?? 0) + 1);
    for (const count of porOrdinal.values()) expect(count).toBeLessThanOrEqual(MAX_SEO_POR_VIERNES);
  });

  it("alerta cuando la cartera excede la capacidad mensual (5 viernes × 2)", () => {
    const servicios = Array.from({ length: 11 }, (_, i) => seoServicio(`s${i}`));
    const { asignaciones, advertencias } = asignarViernesOrdinal(servicios);
    expect(asignaciones).toHaveLength(10);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0].tipo).toBe("sobrecupo_viernes");
  });
});

describe("generarOptimizacionesSeoDelMes (regla A + D)", () => {
  it("usa el viernes real del mes según el ordinal asignado", () => {
    const servicios = [seoServicio("a", 1), seoServicio("b", 3)];
    const { optimizaciones } = generarOptimizacionesSeoDelMes(servicios, [], 2026, 9);
    expect(optimizaciones.find((o) => o.serviceId === "a")?.fechaProgramada).toBe("2026-09-04");
    expect(optimizaciones.find((o) => o.serviceId === "b")?.fechaProgramada).toBe("2026-09-18");
  });

  it("reprograma al viernes anterior cuando el ordinal cae en feriado (18 sep 2026, Fiestas Patrias)", () => {
    const servicios = [seoServicio("a", 3)];
    const holidays = [{ fecha: "2026-09-18", nombre: "Fiestas Patrias" }];
    const { optimizaciones } = generarOptimizacionesSeoDelMes(servicios, holidays, 2026, 9);
    const opt = optimizaciones[0];
    expect(opt.fechaProgramada).toBe("2026-09-11");
    expect(opt.reprogramada).toEqual({ fechaOriginal: "2026-09-18", motivo: "feriado" });
  });

  it("si el viernes anterior ya tiene 2 servicios, busca el siguiente disponible respetando el cupo", () => {
    // "x" y "y" ocupan el viernes 2 (11 sep) de forma legítima; "a" (ordinal 3,
    // 18 sep, feriado) no puede caer ahí y debe seguir retrocediendo.
    const servicios = [seoServicio("x", 2), seoServicio("y", 2), seoServicio("a", 3)];
    const holidays = [{ fecha: "2026-09-18", nombre: "Fiestas Patrias" }];
    const { optimizaciones } = generarOptimizacionesSeoDelMes(servicios, holidays, 2026, 9);

    const fechasOcupadas = optimizaciones.map((o) => o.fechaProgramada);
    const porFecha = new Map<string, number>();
    for (const f of fechasOcupadas) porFecha.set(f, (porFecha.get(f) ?? 0) + 1);
    for (const count of porFecha.values()) expect(count).toBeLessThanOrEqual(MAX_SEO_POR_VIERNES);

    const a = optimizaciones.find((o) => o.serviceId === "a")!;
    expect(a.fechaProgramada).not.toBe("2026-09-11"); // ya lleno
    expect(a.reprogramada?.motivo).toBe("feriado");
  });
});
