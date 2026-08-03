import type { ClienteDetalle } from "./types";

/**
 * Datos de ejemplo hasta que el esquema de Supabase (sección 4.2 del brief)
 * esté disponible — mismo fixture que el prototipo de Claude Design
 * (Provetec Mining), servido para cualquier id.
 */
export function getClienteMock(id: string): ClienteDetalle {
  return {
    id,
    nombre: "Provetec Mining",
    empresa: "Provetec Mining SpA",
    industria: "Minería y filtración",
    sitioWeb: "provetec.cl",
    estado: "activo",
    contactoNombre: "Rodrigo Méndez",
    contactoEmail: "contacto@provetec.cl",
    contactoTelefono: "+56 9 8123 4567",
    logoIniciales: "P",
    proximaOptimizacion: "21 ago 2026",
    servicios: [
      {
        id: "seo",
        tipo: "seo_aeo_geo",
        nombre: "SEO · AEO · GEO",
        color: "var(--color-svc-seo)",
        inicio: "2026-03-12",
        vigencia: "2027-03-12",
        periodo: "12 meses",
        viernesOrdinal: "3.º del mes",
      },
      {
        id: "google",
        tipo: "google_ads",
        nombre: "Google Ads",
        color: "var(--color-svc-google)",
        inicio: "2026-04-15",
        vigencia: "2027-04-15",
        presupuesto: "$900.000",
        ritmo: true,
        ritmoLabel: "+22% sobre ritmo",
      },
    ],
    descuentos: [
      { id: "d1", nombre: "Descuento onboarding", pct: 10, vence: "2026-09-30" },
      { id: "d2", nombre: "Bono fidelidad", pct: 15, vence: "2026-08-12" },
    ],
    tareas: [
      {
        id: "t1",
        titulo: "Revisar canibalización entre fichas de filtros prensa y filtros de manga",
        destino: "checklist",
        svc: "seo",
        who: "MA",
      },
      {
        id: "t2",
        titulo: "Chequear negativas nuevas y términos de búsqueda del mes",
        destino: "recurrente",
        frecuencia: "Cada mes",
        svc: "google",
        who: "AN",
      },
    ],
  };
}

export const SERVICIO_TAREA_OPTS = {
  seo: { label: "SEO · AEO · GEO", color: "var(--color-svc-seo)" },
  google: { label: "Google Ads", color: "var(--color-svc-google)" },
} as const;

export const PERSONAS = {
  MA: { nombre: "Marcel", color: "var(--color-accent)" },
  PA: { nombre: "Paulete", color: "#0f766e" },
  AN: { nombre: "Andrés", color: "#2563eb" },
} as const;

/** Entradas de bitácora ya sincronizadas, previas a la sesión actual. */
export const BITACORA_SEED = [
  {
    id: "seed-1",
    titulo: "Optimización Google Ads",
    cuando: "22 jul 2026",
    desc: "Redistribución de presupuesto por sobregasto (+22%). Se acotó campaña Search.",
    quien: "AN" as const,
    color: "var(--color-svc-google)",
    syncEstado: "pendiente" as const,
  },
  {
    id: "seed-2",
    titulo: "Optimización SEO · AEO · GEO",
    cuando: "17 jul 2026",
    tipoBadge: "Informe enviado",
    desc: "FAQs y datos estructurados nuevos, mejora de títulos, ficha GEO actualizada.",
    quien: "MA" as const,
    color: "var(--color-svc-seo)",
    syncEstado: "ok" as const,
  },
  {
    id: "seed-3",
    titulo: "Informe mensual Google Ads",
    cuando: "2 jul 2026",
    desc: "Informe de junio enviado por email al contacto de Provetec Mining.",
    quien: "AN" as const,
    color: "#64748b",
    syncEstado: "error" as const,
  },
];
