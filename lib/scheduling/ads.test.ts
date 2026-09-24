import { describe, expect, it } from "vitest";
import { asignarDiaSemanaAds, generarOptimizacionesAdsDelMes } from "./ads";
import type { ServicioActivo } from "./types";

describe("asignarDiaSemanaAds (regla B, reparto diario)", () => {
  it("reparte parejo, bucket-fill (día con menos carga primero, empate → el más bajo)", () => {
    const servicios: ServicioActivo[] = Array.from({ length: 6 }, (_, i) => ({
      id: `svc-${i + 1}`,
      clientId: "cliente-1",
      tipo: "meta_ads",
    }));
    const { asignaciones } = asignarDiaSemanaAds(servicios);
    expect(asignaciones.map((a) => a.diaSemana)).toEqual([1, 2, 3, 4, 5, 1]);
  });

  it("un servicio ya asignado nunca se mueve solo (estable)", () => {
    const servicios: ServicioActivo[] = [
      { id: "svc-1", clientId: "cliente-1", tipo: "meta_ads", diaSemanaAdsAsignado: 5 },
      { id: "svc-2", clientId: "cliente-2", tipo: "google_ads" },
    ];
    const { asignaciones } = asignarDiaSemanaAds(servicios);
    expect(asignaciones.find((a) => a.serviceId === "svc-1")?.diaSemana).toBe(5);
    // svc-2 va al día con menos carga (1, ya que 5 quedó con 1 servicio) — no colisiona con svc-1.
    expect(asignaciones.find((a) => a.serviceId === "svc-2")?.diaSemana).toBe(1);
  });
});

describe("generarOptimizacionesAdsDelMes (regla B, reparto diario)", () => {
  const clienteMixto: ServicioActivo[] = [
    { id: "meta-1", clientId: "cliente-1", tipo: "meta_ads", diaSemanaAdsAsignado: 3 }, // miércoles
    { id: "google-1", clientId: "cliente-1", tipo: "google_ads", diaSemanaAdsAsignado: 2 }, // martes
  ];

  it("genera un ítem por semana, en el día de semana asignado a cada servicio, sin hora fija", () => {
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, [], 2026, 9);
    // septiembre 2026: 5 miércoles (meta-1) + 5 martes (google-1)
    expect(optimizaciones).toHaveLength(10);
    const meta = optimizaciones.filter((o) => o.serviceId === "meta-1");
    expect(meta.map((o) => o.fechaProgramada)).toEqual(["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]);
    const google = optimizaciones.filter((o) => o.serviceId === "google-1");
    expect(google.map((o) => o.fechaProgramada)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);
    expect(optimizaciones.every((o) => o.horaProgramada === undefined)).toBe(true);
  });

  it("Meta Ads y Google Ads del mismo cliente son ítems separados, no agrupados, aunque caigan en días distintos", () => {
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, [], 2026, 9);
    expect(optimizaciones.filter((o) => o.clientId === "cliente-1")).toHaveLength(10);
  });

  it("feriado en el día asignado → día hábil siguiente (salta fin de semana si corresponde)", () => {
    // 2026-09-16 es miércoles (día 3, meta-1).
    const holidays = [{ fecha: "2026-09-16", nombre: "feriado de prueba" }];
    const { optimizaciones } = generarOptimizacionesAdsDelMes(clienteMixto, holidays, 2026, 9);
    const afectado = optimizaciones.find((o) => o.serviceId === "meta-1" && o.reprogramada);
    expect(afectado?.fechaProgramada).toBe("2026-09-17");
    expect(afectado?.reprogramada).toEqual({ fechaOriginal: "2026-09-16", motivo: "feriado" });
  });

  it("feriado un viernes → salta el fin de semana hasta el lunes siguiente (no como el jueves fijo de antes)", () => {
    const viernes: ServicioActivo[] = [{ id: "svc-viernes", clientId: "cliente-2", tipo: "meta_ads", diaSemanaAdsAsignado: 5 }];
    // 2026-09-04 es viernes.
    const holidays = [{ fecha: "2026-09-04", nombre: "feriado de prueba" }];
    const { optimizaciones } = generarOptimizacionesAdsDelMes(viernes, holidays, 2026, 9);
    const afectado = optimizaciones.find((o) => o.fechaProgramada !== "2026-09-04" && o.reprogramada?.fechaOriginal === "2026-09-04");
    expect(afectado?.fechaProgramada).toBe("2026-09-07"); // lunes siguiente, no jueves
  });
});
