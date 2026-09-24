/**
 * Tipos fijos de aprobación (§3.11, enum `approval_tipo` en la base). Sin
 * dependencias de servidor — igual que `lib/prompts-categorias.ts`, para
 * poder importarse directo desde componentes cliente sin arrastrar
 * `postgres`/`fs` al bundle del navegador.
 */
export const TIPOS_APROBACION = ["creativo", "presupuesto", "copy", "otro"] as const;
export type ApprovalTipo = (typeof TIPOS_APROBACION)[number];

export const TIPO_APROBACION_LABEL: Record<ApprovalTipo, string> = {
  creativo: "Creativo",
  presupuesto: "Presupuesto",
  copy: "Texto / copy",
  otro: "Otro",
};
