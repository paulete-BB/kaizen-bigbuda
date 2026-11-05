import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ sql: vi.fn() }));
vi.mock("@/lib/google/ads-datos", () => ({ obtenerResumenAds: vi.fn() }));

import { metricasDesdeGoogleAdsApi } from "./prellenado-apis";

const resumen = (o: Partial<Record<string, number | string>>) =>
  ({ moneda: "CLP", costo: 0, clics: 0, impresiones: 0, conversiones: 0, valorConversiones: 0, cpa: 0, ctr: 0, ...o }) as never;

describe("metricasDesdeGoogleAdsApi", () => {
  it("arma las 4 métricas de Resultados con color según criterio", () => {
    const m = metricasDesdeGoogleAdsApi(
      resumen({ costo: 400000, clics: 120, conversiones: 12, cpa: 33333 }),
      resumen({ costo: 300000, clics: 100, conversiones: 10, cpa: 30000 }),
    );
    expect(m.map((x) => x.etiqueta)).toEqual(["Costo", "Clics", "Conversiones", "Costo por conversión"]);
    expect(m[0].favorable).toBe("neutro");
    expect(m[1].favorable).toBe("bueno");
    expect(m[3].favorable).toBe("malo");
  });
});
