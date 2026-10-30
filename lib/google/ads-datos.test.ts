import { beforeEach, describe, expect, it, vi } from "vitest";

const consultar = vi.fn();
vi.mock("@/lib/google/ads", () => ({ consultarGoogleAds: (...a: unknown[]) => consultar(...a) }));

import { obtenerAnunciosAds, obtenerCambiosRecientesAds, obtenerCampanasAds, obtenerKeywordsAds, obtenerResumenAds, obtenerSerieDiariaAds, obtenerTerminosBusquedaAds } from "./ads-datos";

beforeEach(() => consultar.mockReset());

describe("obtenerResumenAds", () => {
  it("convierte micros a unidades y calcula CPA y CTR", async () => {
    consultar.mockResolvedValue([{ customer: { currencyCode: "EUR" }, metrics: { costMicros: "253670000", clicks: "235", impressions: "3800", conversions: 11, conversionsValue: 0 } }]);
    const r = await obtenerResumenAds("1111111111", "2026-09-24", "2026-10-25");
    expect(r.moneda).toBe("EUR");
    expect(r.costo).toBeCloseTo(253.67);
    expect(r.cpa).toBeCloseTo(23.06, 1);
    expect(r.ctr).toBeCloseTo(235 / 3800);
    expect(consultar.mock.calls[0][1]).toContain("BETWEEN '2026-09-24' AND '2026-10-25'");
  });
  it("sin filas devuelve ceros en vez de romper", async () => {
    consultar.mockResolvedValue([]);
    expect(await obtenerResumenAds("1111111111", "2026-09-24", "2026-10-25")).toMatchObject({ costo: 0, clics: 0, cpa: 0, moneda: "" });
  });
  it("rechaza fechas con formato inválido (evita inyectar GAQL)", async () => {
    await expect(obtenerResumenAds("1111111111", "2026-09-24' OR 1=1", "2026-10-25")).rejects.toThrow(/inválido/);
    expect(consultar).not.toHaveBeenCalled();
  });
});

describe("obtenerCampanasAds", () => {
  it("mapea campañas con cuota de impresiones perdida (null si no es de búsqueda)", async () => {
    consultar.mockResolvedValue([
      { campaign: { id: "1", name: "Alta Intención", status: "ENABLED" }, metrics: { costMicros: "100000000", conversions: 5, clicks: "50", impressions: "900", searchImpressionShare: 0.44, searchBudgetLostImpressionShare: 0.56, searchRankLostImpressionShare: 0 } },
      { campaign: { id: "2", name: "PMax", status: "PAUSED" }, metrics: { costMicros: "0", conversions: 0, clicks: "0", impressions: "0" } },
    ]);
    const r = await obtenerCampanasAds("1111111111", "2026-10-01", "2026-10-28");
    expect(r[0]).toMatchObject({ nombre: "Alta Intención", costo: 100, cpa: 20, cuotaImpresiones: 0.44, perdidaPorPresupuesto: 0.56 });
    expect(r[1].cuotaImpresiones).toBeNull();
    expect(consultar.mock.calls[0][1]).toContain("ORDER BY metrics.cost_micros DESC");
  });
});

describe("otras consultas", () => {
  it("serie diaria", async () => {
    consultar.mockResolvedValue([{ segments: { date: "2026-10-01" }, metrics: { costMicros: "2000000", clicks: "3", impressions: "40", conversions: 1 } }]);
    expect(await obtenerSerieDiariaAds("1111111111", "2026-10-01", "2026-10-02")).toEqual([{ fecha: "2026-10-01", costo: 2, clics: 3, impresiones: 40, conversiones: 1 }]);
  });
  it("términos de búsqueda", async () => {
    consultar.mockResolvedValue([{ searchTermView: { searchTerm: "rack para bodega" }, campaign: { name: "C" }, adGroup: { name: "G" }, metrics: { costMicros: "16620000", clicks: "10", conversions: 0 } }]);
    expect((await obtenerTerminosBusquedaAds("1111111111", "2026-10-01", "2026-10-28"))[0]).toMatchObject({ termino: "rack para bodega", costo: 16.62, clics: 10 });
  });
  it("keywords con nivel de calidad", async () => {
    consultar.mockResolvedValue([{ adGroupCriterion: { keyword: { text: "rack para bodega", matchType: "PHRASE" }, qualityInfo: { qualityScore: 3 } }, campaign: { name: "C" }, adGroup: { name: "G" }, metrics: { costMicros: "1000000", clicks: "1", conversions: 0 } }]);
    expect((await obtenerKeywordsAds("1111111111", "2026-10-01", "2026-10-28"))[0]).toMatchObject({ texto: "rack para bodega", concordancia: "PHRASE", nivelCalidad: 3 });
  });
  it("anuncios con fuerza", async () => {
    consultar.mockResolvedValue([{ adGroupAd: { ad: { id: "9" }, adStrength: "POOR", status: "ENABLED" }, campaign: { name: "C" }, adGroup: { name: "G" }, metrics: { costMicros: "5000000", clicks: "4", impressions: "80", conversions: 1 } }]);
    expect((await obtenerAnunciosAds("1111111111", "2026-10-01", "2026-10-28"))[0]).toMatchObject({ id: "9", fuerza: "POOR", costo: 5 });
  });
  it("historial de cambios valida la fecha", async () => {
    consultar.mockResolvedValue([{ changeEvent: { changeDateTime: "2026-10-18 10:00:00", userEmail: "", clientType: "GOOGLE_ADS_RECOMMENDATIONS", changeResourceType: "AD_GROUP_CRITERION", resourceChangeOperation: "REMOVE", changedFields: "x" } }]);
    expect((await obtenerCambiosRecientesAds("1111111111", "2026-10-01"))[0]).toMatchObject({ origen: "GOOGLE_ADS_RECOMMENDATIONS", operacion: "REMOVE" });
    await expect(obtenerCambiosRecientesAds("1111111111", "ayer")).rejects.toThrow(/inválida/);
  });
});
