import { describe, expect, it } from "vitest";
import { construirCalendarioMes } from "./engine";
import type { Absence, ServicioActivo } from "./types";

// Mismo universo de servicios que el seed de demo: Filtrocentro (SEO),
// Provetec Mining (SEO + Google Ads), Tecny Stand (Meta + Google Ads).
const serviciosSeo: ServicioActivo[] = [
  { id: "seo-filtrocentro", clientId: "filtrocentro", tipo: "seo_aeo_geo", responsableId: "marcel" },
  // Ordinal 3 ya asignado (estable) — el 3.er viernes de sep-2026 es 18 sep,
  // el feriado de Fiestas Patrias: fuerza la reprogramación de la regla D.
  { id: "seo-provetec", clientId: "provetec", tipo: "seo_aeo_geo", viernesOrdinalAsignado: 3, responsableId: "marcel" },
];
const serviciosAds: ServicioActivo[] = [
  { id: "google-provetec", clientId: "provetec", tipo: "google_ads", responsableId: "andres" },
  { id: "meta-tecnystand", clientId: "tecnystand", tipo: "meta_ads", responsableId: "andres" },
  { id: "google-tecnystand", clientId: "tecnystand", tipo: "google_ads", responsableId: "andres" },
];
const holidays = [
  { fecha: "2026-09-18", nombre: "Fiestas Patrias" },
  { fecha: "2026-09-19", nombre: "Glorias del Ejército" },
];

describe("construirCalendarioMes — septiembre 2026 (mes de demo, con feriado real)", () => {
  it("genera optimizaciones SEO y Ads sin exceder los límites de cada regla", () => {
    const { optimizaciones, advertencias } = construirCalendarioMes({
      serviciosSeo,
      serviciosAds,
      holidays,
      absences: [],
      year: 2026,
      month: 9,
    });

    const seo = optimizaciones.filter((o) => o.tipo === "seo_aeo_geo");
    const ads = optimizaciones.filter((o) => o.tipo !== "seo_aeo_geo");
    expect(seo).toHaveLength(2);
    expect(ads).toHaveLength(15); // 5 miércoles × 3 servicios ads

    const porViernes = new Map<string, number>();
    for (const o of seo) porViernes.set(o.fechaProgramada, (porViernes.get(o.fechaProgramada) ?? 0) + 1);
    for (const count of porViernes.values()) expect(count).toBeLessThanOrEqual(2);

    expect(advertencias.filter((a) => a.tipo === "sobrecupo_viernes")).toHaveLength(0);
  });

  it("si a alguno de los dos clientes SEO le toca el 18 de septiembre (feriado), queda reprogramado", () => {
    const { optimizaciones } = construirCalendarioMes({
      serviciosSeo,
      serviciosAds,
      holidays,
      absences: [],
      year: 2026,
      month: 9,
    });
    const enFeriado = optimizaciones.find((o) => o.fechaProgramada === "2026-09-18");
    expect(enFeriado).toBeUndefined();
  });

  it("marca conflicto de ausencia sin reasignar responsable por sí solo", () => {
    const absences: Absence[] = [{ userId: "andres", fechaInicio: "2026-09-01", fechaFin: "2026-09-30" }];
    const { optimizaciones } = construirCalendarioMes({
      serviciosSeo: [],
      serviciosAds,
      holidays,
      absences,
      year: 2026,
      month: 9,
    });
    expect(optimizaciones.length).toBeGreaterThan(0);
    expect(optimizaciones.every((o) => o.conflictoAusencia)).toBe(true);
    expect(optimizaciones.every((o) => o.responsableId === "andres")).toBe(true);
  });
});
