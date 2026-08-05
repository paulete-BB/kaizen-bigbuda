export type ServicioTipo = "seo_aeo_geo" | "meta_ads" | "google_ads";

export interface ServicioActivo {
  id: string;
  clientId: string;
  tipo: ServicioTipo;
  /** Solo aplica a seo_aeo_geo. Null/undefined = todavía no asignado. */
  viernesOrdinalAsignado?: number | null;
  responsableId?: string | null;
}

export interface Holiday {
  fecha: string;
  nombre?: string;
}

export interface Absence {
  userId: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface AsignacionOrdinal {
  serviceId: string;
  ordinal: number;
}

export interface OptimizacionGenerada {
  clientId: string;
  serviceId: string;
  tipo: ServicioTipo;
  fechaProgramada: string;
  horaProgramada?: string;
  viernesOrdinal?: number;
  responsableId?: string | null;
  reprogramada?: { fechaOriginal: string; motivo: "feriado" };
  conflictoAusencia?: boolean;
}

export interface Advertencia {
  tipo: "sobrecupo_viernes" | "mes_sin_viernes_suficientes" | "conflicto_ausencia";
  mensaje: string;
  serviceId?: string;
  clientId?: string;
}
