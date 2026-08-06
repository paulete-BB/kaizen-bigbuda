"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export interface GuardarAjustesResultado {
  ok: boolean;
  error?: string;
}

export async function guardarAjustes(formData: FormData): Promise<GuardarAjustesResultado> {
  const session = await requireUser();
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede modificar los ajustes." };
  }

  const clickupWorkspaceId = String(formData.get("clickupWorkspaceId") ?? "").trim();
  const clickupDefaultListId = String(formData.get("clickupDefaultListId") ?? "").trim();
  const diasAlertaDescuento = Number(formData.get("diasAlertaDescuento") ?? 15);
  const diasAlertaVencimientoServicio = Number(formData.get("diasAlertaVencimientoServicio") ?? 20);
  const umbralPacingPct = Number(formData.get("umbralPacingPct") ?? 15);
  const diasAlertaAprobacion = Number(formData.get("diasAlertaAprobacion") ?? 3);
  const diasAlertaOnboarding = Number(formData.get("diasAlertaOnboarding") ?? 5);

  if (
    [diasAlertaDescuento, diasAlertaVencimientoServicio, umbralPacingPct, diasAlertaAprobacion, diasAlertaOnboarding].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  ) {
    return { ok: false, error: "Los umbrales deben ser números positivos." };
  }

  await sql`
    update settings set
      clickup_workspace_id = ${clickupWorkspaceId || null},
      clickup_default_list_id = ${clickupDefaultListId || null},
      dias_alerta_descuento = ${diasAlertaDescuento},
      dias_alerta_vencimiento_servicio = ${diasAlertaVencimientoServicio},
      umbral_pacing_pct = ${umbralPacingPct},
      dias_alerta_aprobacion = ${diasAlertaAprobacion},
      dias_alerta_onboarding = ${diasAlertaOnboarding}
    where id = 1
  `;

  revalidatePath("/ajustes");
  return { ok: true };
}
