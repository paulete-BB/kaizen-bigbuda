import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ sql: vi.fn() }));
vi.mock("@/lib/metricas/snapshot", () => ({
  conCacheDeSnapshot: vi.fn(async (o: { fetchLive: () => Promise<unknown> }) => ({ datos: await o.fetchLive(), obtenidoEn: "x", deCache: false })),
}));
const resumen = vi.fn();
const serie = vi.fn();
const campanas = vi.fn();
vi.mock("@/lib/google/ads-datos", () => ({
  obtenerResumenAds: (...a: unknown[]) => resumen(...a),
  obtenerSerieDiariaAds: (...a: unknown[]) => serie(...a),
  obtenerCampanasAds: (...a: unknown[]) => campanas(...a),
}));

import { seccionGoogleAdsApi } from "./resultados";

const R = (costo: number, clics: number, conversiones: number) => ({ moneda: "EUR", costo, clics, impresiones: 1000, conversiones, valorConversiones: 0, cpa: conversiones ? costo / conversiones : 0, ctr: clics / 1000 });

beforeEach(() => {
  resumen.mockReset();
  serie.mockReset();
  campanas.mockReset();
});

describe("seccionGoogleAdsApi", () => {
  it("arma KPIs en la moneda de la cuenta, series de clics y conversiones y la tabla de campañas", async () => {
    resumen.mockResolvedValueOnce(R(253.67, 235, 11)).mockResolvedValueOnce(R(300, 200, 8));
    serie.mockResolvedValue([{ fecha: "2026-10-02", costo: 8, clics: 7, impresiones: 100, conversiones: 1 }]);
    campanas.mockResolvedValue([{ id: "1", nombre: "Alta Intención", estado: "ENABLED", costo: 100, clics: 50, impresiones: 900, conversiones: 5, cpa: 20, cuotaImpresiones: null, perdidaPorPresupuesto: null, perdidaPorRanking: null }]);

    const s = await seccionGoogleAdsApi("c", "s", "1111111111", "2026-10-01", "2026-10-03", "2026-09-28", "2026-09-30", []);

    expect(s.disponible).toBe(true);
    expect(s.fuente).toBe("api");
    expect(s.moneda).toBe("EUR");
    expect(s.kpis.map((k) => k.etiqueta)).toEqual(["Costo", "Clics", "Conversiones", "Costo por conversión"]);
    expect(s.kpis[2].valor).toBe("11");
    expect(s.kpis[3].valor).toContain("23,06");
    // El costo por conversión bajó (300/8=37,5 → 23,06): es buena noticia.
    expect(s.kpis[3].delta?.favorable).toBe(true);
    expect(s.serie).toEqual([
      { fecha: "2026-10-01", valor: 0 },
      { fecha: "2026-10-02", valor: 7 },
      { fecha: "2026-10-03", valor: 0 },
    ]);
    expect(s.serieConversiones?.[1].valor).toBe(1);
    expect(s.campanas[0]).toMatchObject({ nombre: "Alta Intención", interacciones: 50, conversiones: 5 });
  });

  it("si fallan la serie y las campañas igual muestra el resumen", async () => {
    resumen.mockResolvedValue(R(10, 5, 1));
    serie.mockRejectedValue(new Error("boom"));
    campanas.mockRejectedValue(new Error("boom"));
    const s = await seccionGoogleAdsApi("c", "s", "1111111111", "2026-10-01", "2026-10-03", "2026-09-28", "2026-09-30", []);
    expect(s.disponible).toBe(true);
    expect(s.campanas).toEqual([]);
  });

  it("si falla el resumen devuelve el motivo de la API en vez de romper la página", async () => {
    resumen.mockRejectedValue(new Error("El usuario de Google conectado no tiene acceso a esta cuenta de Google Ads"));
    serie.mockResolvedValue([]);
    campanas.mockResolvedValue([]);
    const s = await seccionGoogleAdsApi("c", "s", "1111111111", "2026-10-01", "2026-10-03", "2026-09-28", "2026-09-30", []);
    expect(s.disponible).toBe(false);
    expect(s.motivo).toMatch(/no tiene acceso/);
  });
});
