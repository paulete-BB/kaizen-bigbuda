export type ServicioTipo = "seo_aeo_geo" | "meta_ads" | "google_ads";

export interface Servicio {
  id: string;
  tipo: ServicioTipo;
  nombre: string;
  color: string;
  inicio: string;
  vigencia: string;
  periodo?: string;
  viernesOrdinal?: string;
  presupuesto?: string;
  ritmo?: boolean;
  ritmoLabel?: string;
}

export interface Descuento {
  id: string;
  nombre: string;
  pct: number;
  vence: string;
}

export type TareaDestino = "checklist" | "recurrente";

export interface Tarea {
  id: string;
  titulo: string;
  destino: TareaDestino;
  frecuencia?: string;
  svc: "seo" | "google";
  who: "MA" | "PA" | "AN";
}

export interface CambioBitacora {
  id: string;
  titulo: string;
  desc: string;
  tipo: string;
  cuando: string;
}

export interface ClienteDetalle {
  id: string;
  nombre: string;
  empresa: string;
  industria: string;
  sitioWeb: string;
  estado: "activo" | "pausado" | "finalizado";
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string;
  logoIniciales: string;
  proximaOptimizacion: string;
  servicios: Servicio[];
  descuentos: Descuento[];
  tareas: Tarea[];
}
