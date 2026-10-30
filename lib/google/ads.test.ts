import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google/oauth", () => ({ obtenerAccessTokenGoogle: vi.fn(async () => "access-token") }));

import { consultarGoogleAds, normalizarCustomerId, probarConexionGoogleAds, traducirErrorGoogleAds } from "./ads";

const error = (status: number, code: string, message = "x") =>
  new Response(JSON.stringify([{ error: { code: status, status: "PERMISSION_DENIED", message, details: [{ errors: [{ errorCode: { authorizationError: code } }] }] } }]), { status });
const ok = (results: unknown[]) => new Response(JSON.stringify([{ results }]));

beforeEach(() => {
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  delete process.env.GOOGLE_ADS_API_VERSION;
});

describe("normalizarCustomerId", () => {
  it("acepta con o sin guiones y rechaza lo que no tiene 10 dígitos", () => {
    expect(normalizarCustomerId("738-056-4660")).toBe("7380564660");
    expect(normalizarCustomerId(" 7380564660 ")).toBe("7380564660");
    expect(normalizarCustomerId("123")).toBeNull();
    expect(normalizarCustomerId("")).toBeNull();
  });
});

describe("traducirErrorGoogleAds", () => {
  it("traduce el acceso de prueba del proyecto", () => {
    const e = traducirErrorGoogleAds(403, { error: { details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" } }] }] } });
    expect(e.message).toMatch(/acceso de prueba/);
    expect(e.message).toMatch(/Explorador/);
    expect(e.permisoDenegado).toBe(false);
  });
  it("marca el permiso denegado para poder reintentar por la MCC", () => {
    expect(traducirErrorGoogleAds(403, { error: { details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" } }] }] } }).permisoDenegado).toBe(true);
  });
  it("usa el mensaje de Google si el código no está catalogado", () => {
    expect(traducirErrorGoogleAds(400, { error: { message: "algo raro" } }).message).toBe("algo raro");
  });
});

describe("consultarGoogleAds", () => {
  it("con acceso directo manda las cabeceras sin developer token ni login-customer-id y junta los lotes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ results: [{ a: 1 }] }, { results: [{ a: 2 }] }])));
    vi.stubGlobal("fetch", fetchMock);
    const filas = await consultarGoogleAds("1111111111", "SELECT 1");
    expect(filas).toEqual([{ a: 1 }, { a: 2 }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://googleads.googleapis.com/v23/customers/1111111111/googleAds:searchStream");
    const h = init.headers as Record<string, string>;
    expect(h["developer-token"]).toBeUndefined();
    expect(h.Authorization).toBe("Bearer access-token");
    expect(h["login-customer-id"]).toBeUndefined();
  });

  it("si no hay acceso directo reintenta con la MCC y recuerda la forma que funcionó", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(error(403, "USER_PERMISSION_DENIED"))
      .mockResolvedValueOnce(ok([{ x: 1 }]))
      .mockResolvedValueOnce(ok([{ x: 2 }]));
    vi.stubGlobal("fetch", fetchMock);
    await consultarGoogleAds("2222222222", "SELECT 1");
    const segundaCabecera = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(segundaCabecera["login-customer-id"]).toBe("9489902568");
    await consultarGoogleAds("2222222222", "SELECT 1");
    expect(fetchMock).toHaveBeenCalledTimes(3); // la tercera va directo con la MCC, sin probar de nuevo sin cabecera
    expect(((fetchMock.mock.calls[2] as unknown as [string, RequestInit])[1].headers as Record<string, string>)["login-customer-id"]).toBe("9489902568");
  });

  it("no reintenta con la MCC por errores que no son de permiso", async () => {
    const fetchMock = vi.fn(async () => error(403, "DEVELOPER_TOKEN_NOT_APPROVED"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(consultarGoogleAds("3333333333", "SELECT 1")).rejects.toThrow(/acceso de prueba/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no manda developer token aunque exista la variable (Google ya no los usa)", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "abcdefghijklmnopqrstuv";
    const fetchMock = vi.fn(async () => ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await consultarGoogleAds("4444444444", "SELECT 1");
    expect(((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)["developer-token"]).toBeUndefined();
  });

  it("respeta la versión configurada por variable de entorno", async () => {
    process.env.GOOGLE_ADS_API_VERSION = "v24";
    const fetchMock = vi.fn(async () => ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await consultarGoogleAds("5555555555", "SELECT 1");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain("/v24/");
  });
});

describe("probarConexionGoogleAds", () => {
  it("devuelve nombre, moneda y zona horaria de la cuenta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok([{ customer: { id: "6666666666", descriptiveName: "TECNY STAND CHILE", currencyCode: "EUR", timeZone: "America/Santiago" } }])));
    expect(await probarConexionGoogleAds("6666666666")).toEqual({ id: "6666666666", nombre: "TECNY STAND CHILE", moneda: "EUR", zonaHoraria: "America/Santiago" });
  });
});
