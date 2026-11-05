import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerCampanasMeta, obtenerResumenMeta, obtenerSerieDiariaMeta, parseExcluirCampanas } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_TOKEN;
});

describe("obtenerSerieDiariaMeta", () => {
  it("pide un límite alto: Meta devuelve solo 25 filas por página por defecto y la serie quedaba cortada", async () => {
    process.env.META_TOKEN = "token-de-prueba";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ date_start: "2026-10-01", spend: "1", impressions: "2", clicks: "3" }] })));
    vi.stubGlobal("fetch", fetchMock);

    const serie = await obtenerSerieDiariaMeta({ adAccountId: "123", metaTokenKey: null }, "2026-07-30", "2026-10-27");

    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(Number(url.searchParams.get("limit"))).toBeGreaterThanOrEqual(120);
    expect(url.searchParams.get("time_increment")).toBe("1");
    expect(serie).toHaveLength(1);
    expect(serie[0].clics).toBe(3);
  });
});

describe("excluir campañas de otra gente en la misma cuenta", () => {
  it("parsea los fragmentos separados por coma", () => {
    expect(parseExcluirCampanas(" Siria, familia ,")).toEqual(["Siria", "familia"]);
    expect(parseExcluirCampanas(null)).toEqual([]);
  });

  it("manda un filtro NOT_CONTAIN por fragmento en resumen, serie y campañas, y nada si no hay", async () => {
    process.env.META_TOKEN = "token-de-prueba";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const cfg = { adAccountId: "1", metaTokenKey: null, excluirCampanas: ["Siria"] };
    await obtenerResumenMeta(cfg, "2026-10-01", "2026-10-07");
    await obtenerSerieDiariaMeta(cfg, "2026-10-01", "2026-10-07");
    await obtenerCampanasMeta(cfg, "2026-10-01", "2026-10-07");
    for (const call of fetchMock.mock.calls) {
      const url = new URL((call as unknown as [string])[0]);
      expect(JSON.parse(url.searchParams.get("filtering")!)).toEqual([{ field: "campaign.name", operator: "NOT_CONTAIN", value: "Siria" }]);
    }
    await obtenerResumenMeta({ adAccountId: "1", metaTokenKey: null }, "2026-10-01", "2026-10-07");
    const ultima = new URL((fetchMock.mock.calls.at(-1) as unknown as [string])[0]);
    expect(ultima.searchParams.has("filtering")).toBe(false);
  });
});
