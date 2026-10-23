// Tipos y constantes del agente de optimización, sin dependencias de
// servidor — los importan tanto el backend como los componentes cliente.

export type PrioridadPlan = "alta" | "media" | "baja";
export type TipoItemPlan = "accion" | "esperar_datos" | "revisar";
export type EstadoItemPlan = "pendiente" | "hecha" | "descartada";

export interface ItemPlan {
  id: string;
  prioridad: PrioridadPlan;
  tipo: TipoItemPlan;
  titulo: string;
  detalle: string;
  /** Para `esperar_datos`/`revisar`: fecha (YYYY-MM-DD) desde la cual se puede volver a evaluar. */
  revisarEn?: string | null;
  estado: EstadoItemPlan;
}

export const TIPO_ITEM_LABEL: Record<TipoItemPlan, string> = {
  accion: "Acción",
  esperar_datos: "Esperar datos",
  revisar: "Revisar",
};

export type EventoAgente =
  | { type: "texto"; delta: string }
  | { type: "herramienta"; nombre: string; estado: "inicio" | "fin" | "error" }
  | { type: "plan"; plan: ItemPlan[] }
  | { type: "resumen"; resumen: string; hallazgos: string }
  | { type: "fin" }
  | { type: "error"; mensaje: string };
