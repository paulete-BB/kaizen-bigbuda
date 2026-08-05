import { describe, expect, it } from "vitest";
import { generarOptimizacionesAdsDelMes, HORA_BLOQUE_ADS } from "./ads";
import type { ServicioActivo } from "./types";

describe("generarOptimizacionesAdsDelMes (regla B)", () => {
  const clienteMixto: ServicioActivo[] = [
    { id: "meta-1", clientId: "cliente-1", tipo: "meta_ads" },
    { id: "google-1", clientId: "cliente-1", tipo: "google_ads" },
  ];

  it("genera un ítem por cada miércoles del mes por cada servicio", () => {
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, [], 2026, 9);
    // 5 miércoles en sep-2026 × 2 servicios
    expect(optimizaciones).toHaveLength(10);
  });

  it("Meta Ads y Google Ads del mismo cliente son ítems separados, no agrupados", () => {
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, [], 2026, 9);
    const primerMiercoles = optimizaciones.filter((o) => o.fechaProgramada === "2026-09-02");
    expect(primerMiercoles).toHaveLength(2);
    expect(primerMiercoles.map((o) => o.serviceId).sort()).toEqual(["google-1", "meta-1"]);
    expect(primerMiercoles.every((o) => o.horaProgramada === HORA_BLOQUE_ADS)).toBe(true);
  });

  it("miércoles feriado se reprograma al jueves siguiente a las 16:00", () => {
    const holidays = [{ fecha: "2026-09-16", nombre: "feriado de prueba" }];
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, holidays, 2026, 9);
    const afectados = optimizaciones.filter((o) => o.reprogramada);
    expect(afectados).toHaveLength(2);
    for (const o of afectados) {
      expect(o.fechaProgramada).toBe("2026-09-17");
      expect(o.horaProgramada).toBe(HORA_BLOQUE_ADS);
      expect(o.reprogramada).toEqual({ fechaOriginal: "2026-09-16", motivo: "feriado" });
    }
  });
});
