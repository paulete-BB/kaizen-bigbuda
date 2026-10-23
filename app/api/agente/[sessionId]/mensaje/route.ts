import { getSession } from "@/lib/auth/server";
import { agregarMensajeUsuario, correrTurno } from "@/lib/agente/loop";
import type { EventoAgente } from "@/lib/agente/tipos";

// Una auditoría con varias llamadas a Meta/GA4 más el razonamiento del modelo
// puede pasar del límite por defecto de la función serverless.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST { texto?: string } — si trae `texto`, lo agrega como mensaje del
 * usuario antes de correr el turno; sin `texto` responde al último mensaje
 * pendiente (el inicial de la sesión). Devuelve NDJSON con `EventoAgente`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });

  const { sessionId } = await params;
  const body = (await request.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (texto.length > 8000) return new Response("Mensaje demasiado largo", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitir = (e: EventoAgente) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // el cliente cortó la conexión; el turno sigue y todo queda guardado
        }
      };
      try {
        if (texto) await agregarMensajeUsuario(sessionId, texto);
        await correrTurno(sessionId, emitir);
      } catch (e) {
        emitir({ type: "error", mensaje: e instanceof Error ? e.message : String(e) });
      } finally {
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
