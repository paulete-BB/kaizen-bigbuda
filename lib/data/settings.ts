import { sql } from "@/lib/db";

export interface Settings {
  clickupWorkspaceId: string | null;
  clickupDefaultListId: string | null;
  clickupBitacoraDocId: string | null;
  diasAlertaDescuento: number;
  diasAlertaVencimientoServicio: number;
  umbralPacingPct: number;
  diasAlertaAprobacion: number;
  diasAlertaOnboarding: number;
}

export async function getSettings(): Promise<Settings> {
  const [row] = await sql<
    {
      clickup_workspace_id: string | null;
      clickup_default_list_id: string | null;
      clickup_bitacora_doc_id: string | null;
      dias_alerta_descuento: number;
      dias_alerta_vencimiento_servicio: number;
      umbral_pacing_pct: number;
      dias_alerta_aprobacion: number;
      dias_alerta_onboarding: number;
    }[]
  >`select * from settings where id = 1`;

  return {
    clickupWorkspaceId: row.clickup_workspace_id,
    clickupDefaultListId: row.clickup_default_list_id,
    clickupBitacoraDocId: row.clickup_bitacora_doc_id,
    diasAlertaDescuento: row.dias_alerta_descuento,
    diasAlertaVencimientoServicio: row.dias_alerta_vencimiento_servicio,
    umbralPacingPct: row.umbral_pacing_pct,
    diasAlertaAprobacion: row.dias_alerta_aprobacion,
    diasAlertaOnboarding: row.dias_alerta_onboarding,
  };
}
