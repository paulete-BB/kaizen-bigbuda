import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerSerieDiariaMeta } from "./client";

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
