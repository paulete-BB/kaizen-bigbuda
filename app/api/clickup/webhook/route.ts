import { NextResponse } from "next/server";
import { procesarWebhookClickUp } from "@/lib/clickup/webhook";

/**
 * Endpoint de webhooks de ClickUp (§3.5, taskStatusUpdated). Lee el body
 * como texto crudo antes de parsearlo — la firma HMAC de ClickUp se calcula
 * sobre esos bytes exactos, así que pasar por `req.json()` primero
 * invalidaría la verificación.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const firma = req.headers.get("x-signature");

  const resultado = await procesarWebhookClickUp(rawBody, firma);
  if (!resultado.ok) {
    if (process.env.CLICKUP_DEBUG) console.error("webhook ClickUp rechazado:", resultado.motivo);
    // Firma inválida: rechazo de autenticación. Cualquier otra falla (token
    // ausente, ClickUp API caída al reconsultar la tarea): 500, para que
    // ClickUp reintente la entrega más tarde en vez de descartarla.
    return NextResponse.json({ ok: false }, { status: resultado.motivo === "firma inválida" ? 401 : 500 });
  }
  return NextResponse.json({ ok: true });
}
