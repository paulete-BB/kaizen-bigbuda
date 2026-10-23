"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { construirMensajeInicial, cargarDatosSesion } from "@/lib/agente/contexto";
import { completarOptimizacionAds } from "@/lib/data/optimizacion-ads-completar";
import { hoySantiago, toIso } from "@/lib/dates";
import type { EstadoItemPlan, ItemPlan } from "@/lib/agente/tipos";

const TIPO_LABEL = { meta_ads: "Meta Ads", google_ads: "Google Ads" } as const;

/** Crea (o retoma) la sesión del agente de una optimización de Ads y lleva a su pantalla. */
export async function iniciarOptimizacion(formData: FormData) {
  const session = await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  if (!optimizationId) return;

  const [opt] = await sql<{ client_id: string; service_id: string; tipo: string; estado: string }[]>`
    select client_id, service_id, tipo, estado from optimizations where id = ${optimizationId}
  `;
  if (!opt || opt.tipo === "seo_aeo_geo") return;

  const [existente] = await sql<{ id: string }[]>`select id from agent_sessions where optimization_id = ${optimizationId}`;
  if (!existente) {
    const [nueva] = await sql<{ id: string }[]>`
      insert into agent_sessions (optimization_id, client_id, service_id, creado_por)
      values (${optimizationId}, ${opt.client_id}, ${opt.service_id}, ${session.userId})
      on conflict (optimization_id) do nothing
      returning id
    `;
    if (nueva) {
      const datos = await cargarDatosSesion(nueva.id);
      if (datos) {
        const inicial = await construirMensajeInicial(datos);
        await sql`insert into agent_messages (session_id, orden, rol, contenido) values (${nueva.id}, 0, 'user', ${sql.json([{ type: "text", text: inicial }] as never)})`;
      }
    }
  }
  redirect(`/optimizaciones/${optimizationId}/agente`);
}

export async function actualizarEstadoItemPlan(sessionId: string, itemId: string, estado: EstadoItemPlan): Promise<{ ok: boolean }> {
  await requireUser();
  const [s] = await sql<{ plan: ItemPlan[]; estado: string }[]>`select plan, estado from agent_sessions where id = ${sessionId}`;
  if (!s || s.estado === "cerrada") return { ok: false };
  const plan = s.plan.map((it) => (it.id === itemId ? { ...it, estado } : it));
  await sql`update agent_sessions set plan = ${sql.json(plan as never)}, actualizado_en = now() where id = ${sessionId}`;
  return { ok: true };
}

/** Lo que queda abierto del plan se registra como "próximos pasos" para que la próxima optimización lo encuentre. */
function proximosPasosDesdePlan(plan: ItemPlan[]): string {
  const abiertos = plan.filter((it) => it.estado === "pendiente");
  if (abiertos.length === 0) return "";
  return abiertos
    .map((it) => {
      const etiqueta = it.tipo === "esperar_datos" ? "En espera de datos" : it.tipo === "revisar" ? "Revisar" : "Pendiente";
      const desde = it.revisarEn ? ` (desde ${it.revisarEn})` : "";
      return `- ${etiqueta}${desde}: ${it.titulo}`;
    })
    .join("\n");
}

/** Cierra la optimización con el resumen revisado por la persona: va a la bitácora (interna + ClickUp) y genera la próxima semana. */
export async function cerrarOptimizacionConAgente(input: { sessionId: string; resumen: string; hallazgos: string }): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const resumen = input.resumen.trim();
  if (resumen.length < 10) return { ok: false, error: "Escribe el resumen de la optimización antes de cerrar." };

  const [s] = await sql<{ optimization_id: string; client_id: string; estado: string; plan: ItemPlan[]; tipo: "meta_ads" | "google_ads"; fecha_programada: string }[]>`
    select s.optimization_id, s.client_id, s.estado, s.plan, o.tipo, o.fecha_programada
    from agent_sessions s join optimizations o on o.id = s.optimization_id
    where s.id = ${input.sessionId}
  `;
  if (!s) return { ok: false, error: "Sesión no encontrada." };
  if (s.estado === "cerrada") return { ok: false, error: "Esta optimización ya estaba cerrada." };

  // Cierra la sesión primero con una condición, para que un doble clic no complete dos veces.
  const cerradas = await sql`update agent_sessions set estado = 'cerrada', resumen_borrador = ${resumen}, hallazgos_borrador = ${input.hallazgos.trim() || null}, actualizado_en = now() where id = ${input.sessionId} and estado = 'en_curso' returning id`;
  if (cerradas.length === 0) return { ok: false, error: "Esta optimización ya estaba cerrada." };

  const hallazgos = input.hallazgos.trim();
  const proximos = proximosPasosDesdePlan(s.plan);
  const partes = [resumen];
  if (hallazgos) partes.push(`**Hallazgos:** ${hallazgos}`);
  if (proximos) partes.push(`**En espera / próximos pasos:**\n${proximos}`);

  try {
    await sql`update optimizations set resumen = ${resumen} where id = ${s.optimization_id}`;
    await completarOptimizacionAds({
      optimizationId: s.optimization_id,
      clientId: s.client_id,
      tipoLabel: TIPO_LABEL[s.tipo],
      userId: user.userId,
      fechaRealizada: toIso(hoySantiago()),
      fechaBase: s.fecha_programada,
      contenidoBitacora: partes.join("\n\n"),
      hallazgos: hallazgos || null,
      proximosPasos: proximos || null,
    });
  } catch (e) {
    await sql`update agent_sessions set estado = 'en_curso' where id = ${input.sessionId}`;
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cerrar la optimización." };
  }

  revalidatePath(`/optimizaciones/${s.optimization_id}/agente`);
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  return { ok: true };
}
