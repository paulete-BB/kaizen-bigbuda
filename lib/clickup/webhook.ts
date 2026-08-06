import crypto from "node:crypto";
import { sql } from "@/lib/db";

const API_V2 = "https://api.clickup.com/api/v2";

export interface ResultadoWebhookClickUp {
  ok: boolean;
  motivo?: string;
}

/** Firma real: HMAC-SHA256 en hex sobre el body crudo, con el secret devuelto al crear el webhook — https://developer.clickup.com/docs/webhooksignature */
function firmaValida(rawBody: string, firmaHeader: string | null, secret: string): boolean {
  if (!firmaHeader) return false;
  const esperada = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const recibida = Buffer.from(firmaHeader);
  const calculada = Buffer.from(esperada);
  if (recibida.length !== calculada.length) return false;
  return crypto.timingSafeEqual(recibida, calculada);
}

/**
 * Refleja en la plataforma cuando el equipo completa una tarea desde
 * ClickUp (§3.5, sincronización bidireccional mínima). No marca la
 * optimización como `realizada` de una — eso requiere el registro real
 * (resumen/hallazgos) que dispara la escritura en bitácora y la
 * programación de la siguiente optimización (`guardarRegistroSeo`); acá
 * solo se guarda la fecha de completado en ClickUp para que la alerta del
 * dashboard avise que falta pasar por el registro. Cada lista tiene sus
 * propios nombres de estado (confirmado contra el workspace real), así que
 * el único indicador realmente terminal es `status.type === "closed"` —ni
 * siquiera "done" alcanza, se usa también para estados no terminales como
 * "rechazado" o "en pausa" en las listas reales del workspace—, y se
 * re-consulta la tarea en vez de confiar en el body del webhook para
 * obtenerlo con certeza.
 */
export async function procesarWebhookClickUp(rawBody: string, firmaHeader: string | null): Promise<ResultadoWebhookClickUp> {
  const [settings] = await sql<{ clickup_webhook_secret: string | null }[]>`
    select clickup_webhook_secret from settings where id = 1
  `;
  if (!settings?.clickup_webhook_secret) return { ok: false, motivo: "webhook no configurado" };
  if (!firmaValida(rawBody, firmaHeader, settings.clickup_webhook_secret)) {
    return { ok: false, motivo: "firma inválida" };
  }

  let evento: { event?: string; task_id?: string };
  try {
    evento = JSON.parse(rawBody);
  } catch {
    return { ok: false, motivo: "body inválido" };
  }
  if (evento.event !== "taskStatusUpdated" || !evento.task_id) {
    return { ok: true, motivo: "evento ignorado" };
  }

  const [optimizacion] = await sql<{ id: string }[]>`
    select id from optimizations where clickup_task_id = ${evento.task_id}
  `;
  if (!optimizacion) return { ok: true, motivo: "tarea no asociada a una optimización" };

  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) return { ok: false, motivo: "CLICKUP_API_TOKEN no configurado" };

  const res = await fetch(`${API_V2}/task/${evento.task_id}`, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { ok: false, motivo: `ClickUp API ${res.status}` };
  const task = (await res.json()) as { status?: { type?: string } };
  const cerrada = task.status?.type === "closed";

  await sql`
    update optimizations set clickup_completada_en = ${cerrada ? new Date() : null}
    where id = ${optimizacion.id}
  `;

  return { ok: true };
}
