import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import { hoySantiago, toIso } from "@/lib/dates";
import { cargarDatosSesion, type DatosSesion } from "@/lib/agente/contexto";
import { ejecutarHerramienta, herramientasPara } from "@/lib/agente/herramientas";
import type { EventoAgente } from "@/lib/agente/tipos";

const MODELO = process.env.AGENTE_MODEL ?? "claude-opus-5-5";
const MAX_ITERACIONES = 14;
const BLOQUEO_MINUTOS = 10;

function promptSistema(datos: DatosSesion): string {
  const canal = datos.tipo === "meta_ads" ? "Meta Ads" : "Google Ads";
  const limitacion =
    datos.tipo === "google_ads"
      ? "\n- Google Ads se ve solo a través de GA4 (no hay API de Google Ads conectada): los datos de campaña pueden diferir de los que muestra Google Ads (atribución distinta, costo que depende de la vinculación Ads↔GA4). Dilo cuando una conclusión dependa de eso, y no recomiendes acciones que requieran datos que no tienes (términos de búsqueda, calidad de anuncio, ajustes de puja) sin avisar que hay que verlos directo en Google Ads."
      : "\n- La conversión que importa es la del sitio (GA4, canal Paid Social); el 'resultado' de Meta es un proxy. En campañas de mensajes la conversión real son las conversaciones iniciadas (dato de Meta), no GA4.";
  return `Eres el analista senior de ${canal} de Bigbuda, una agencia de marketing digital (Santiago · Toronto). Ayudas a una persona del equipo a hacer la optimización semanal de una cuenta de cliente: auditas, priorizas y dejas un plan claro. La persona ejecuta los cambios; tú no tienes acceso para modificar campañas.

Cómo trabajas:
1. Antes de mirar la cuenta, lee el historial que se te entrega (últimas optimizaciones y pendientes heredados) y resume qué quedó pendiente o en espera. Si algo estaba esperando más datos, respeta su fecha de revisión: no recomiendes cambiarlo antes, y si ya se cumplió el plazo, evalúalo con los datos nuevos.
2. Audita la cuenta con tus herramientas: rendimiento reciente vs. periodo anterior, campañas y conjuntos que gastan sin convertir, pacing contra el presupuesto, tendencias después de los últimos cambios, aprobaciones del cliente que bloquean algo. Pide rangos concretos (por ejemplo últimos 7 días y los 7 anteriores, o el mes en curso) y compara.
3. Guarda el plan con guardar_plan: priorizado (primero lo de mayor impacto y menor esfuerzo), con acciones concretas (qué campaña/conjunto/anuncio, qué cambio, de qué magnitud, por qué con el dato que lo respalda y cómo medir el efecto). Incluye como 'esperar_datos' lo que decides NO tocar y la fecha en que corresponde revisarlo. Pocas acciones bien elegidas valen más que una lista larga.
4. Después sigue conversando: ajusta el plan si te lo piden, ayuda a redactar copys o a decidir, y responde dudas. Cuando la persona quiera cerrar, redacta el resumen con guardar_resumen.

Reglas:
- No inventes cifras, campañas ni hechos. Cada afirmación debe salir de una herramienta o del historial. Si una herramienta falla o falta configuración, dilo y trabaja con lo que haya; no rellenes.
- No pises decisiones anteriores sin explicarlo: si contradices algo que se hizo o se dejó en espera, di por qué.
- No prometas resultados; usa lenguaje prudente.
- Español de Chile, sin voseo, directo y breve. Montos con la moneda de la cuenta.
- El resumen de cierre va a la bitácora del cliente: qué se hizo o decidió esta semana, qué queda en espera (con fecha de revisión) y qué se revisa la próxima vez. Texto plano, sin relleno ni mencionar que lo escribió una IA.${limitacion}

Fecha de hoy: ${toIso(hoySantiago())}. Cliente: ${datos.clienteNombre}. Servicio: ${canal}.`;
}

async function adquirirBloqueo(sessionId: string): Promise<boolean> {
  const filas = await sql`
    update agent_sessions set procesando_desde = now()
    where id = ${sessionId} and (procesando_desde is null or procesando_desde < now() - make_interval(mins => ${BLOQUEO_MINUTOS}))
    returning id
  `;
  return filas.length > 0;
}

async function liberarBloqueo(sessionId: string) {
  await sql`update agent_sessions set procesando_desde = null where id = ${sessionId}`;
}

async function cargarMensajes(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await sql<{ rol: "user" | "assistant"; contenido: Anthropic.MessageParam["content"] }[]>`
    select rol, contenido from agent_messages where session_id = ${sessionId} order by orden
  `;
  return rows.map((r) => ({ role: r.rol, content: r.contenido }));
}

async function guardarMensaje(sessionId: string, orden: number, rol: "user" | "assistant", contenido: unknown) {
  await sql`insert into agent_messages (session_id, orden, rol, contenido) values (${sessionId}, ${orden}, ${rol}, ${sql.json(contenido as never)})`;
}

/**
 * Corre un turno del agente: si el último mensaje guardado es del usuario,
 * llama al modelo en bucle (herramientas incluidas) hasta que termina, y
 * emite eventos para pintar en vivo en el cliente. Cada mensaje se guarda
 * apenas se completa, así que un corte a mitad de camino conserva todo lo
 * ya hecho. Un bloqueo en `agent_sessions.procesando_desde` evita que dos
 * pestañas (o un doble clic) corran el mismo turno a la vez.
 */
export async function correrTurno(sessionId: string, emitir: (e: EventoAgente) => void): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    emitir({ type: "error", mensaje: "ANTHROPIC_API_KEY no está configurada en el servidor." });
    return;
  }
  const datos = await cargarDatosSesion(sessionId);
  if (!datos) {
    emitir({ type: "error", mensaje: "Sesión no encontrada o servicio no soportado." });
    return;
  }
  if (datos.estado === "cerrada") {
    emitir({ type: "error", mensaje: "Esta optimización ya está cerrada." });
    return;
  }
  if (!(await adquirirBloqueo(sessionId))) {
    emitir({ type: "error", mensaje: "El agente ya está trabajando en esta sesión; espera a que termine." });
    return;
  }

  try {
    const mensajes = await cargarMensajes(sessionId);

    // Si un turno anterior se cortó entre el mensaje del modelo y los resultados de sus herramientas,
    // el historial quedaría inválido para la API: se cierran esas llamadas como interrumpidas.
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo?.role === "assistant" && Array.isArray(ultimo.content)) {
      const huerfanas = ultimo.content.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use");
      if (huerfanas.length > 0) {
        const cierre: Anthropic.ToolResultBlockParam[] = huerfanas.map((b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: "Error: la herramienta no llegó a ejecutarse (turno interrumpido). Vuelve a llamarla si la necesitas.",
          is_error: true,
        }));
        mensajes.push({ role: "user", content: cierre });
        await guardarMensaje(sessionId, mensajes.length - 1, "user", cierre);
      }
    }

    if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== "user") {
      emitir({ type: "error", mensaje: "No hay un mensaje pendiente de responder." });
      return;
    }

    const client = new Anthropic();
    const tools = herramientasPara(datos.tipo);
    const system = promptSistema(datos);
    let orden = mensajes.length;

    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const stream = client.messages.stream({
        model: MODELO,
        max_tokens: 32000,
        system,
        tools,
        output_config: { effort: "high" },
        messages: mensajes,
      });
      stream.on("text", (delta) => emitir({ type: "texto", delta }));
      const respuesta = await stream.finalMessage();

      mensajes.push({ role: "assistant", content: respuesta.content });
      await guardarMensaje(sessionId, orden++, "assistant", respuesta.content);

      if (respuesta.stop_reason === "refusal") {
        emitir({ type: "error", mensaje: "El modelo rechazó continuar con esta solicitud." });
        return;
      }
      if (respuesta.stop_reason === "max_tokens") {
        emitir({ type: "error", mensaje: "La respuesta se cortó por largo; pídele que continúe." });
        return;
      }
      if (respuesta.stop_reason === "pause_turn") continue;
      if (respuesta.stop_reason !== "tool_use") break;

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloque of respuesta.content) {
        if (bloque.type !== "tool_use") continue;
        const { contenido, esError } = await ejecutarHerramienta(bloque.name, bloque.input, { datos, emitir });
        resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: contenido, ...(esError ? { is_error: true } : {}) });
      }
      mensajes.push({ role: "user", content: resultados });
      await guardarMensaje(sessionId, orden++, "user", resultados);
      emitir({ type: "texto", delta: "\n\n" });

      if (i === MAX_ITERACIONES - 1) emitir({ type: "error", mensaje: "El agente alcanzó el máximo de pasos del turno; escríbele para que continúe." });
    }
    emitir({ type: "fin" });
  } catch (e) {
    const mensaje = e instanceof Anthropic.APIError ? `Error de la API de Anthropic (${e.status ?? "red"}): ${e.message}` : e instanceof Error ? e.message : String(e);
    emitir({ type: "error", mensaje });
  } finally {
    await liberarBloqueo(sessionId);
  }
}

/** Agrega un mensaje del usuario a la conversación (para el chat). */
export async function agregarMensajeUsuario(sessionId: string, texto: string): Promise<void> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from agent_messages where session_id = ${sessionId}`;
  await guardarMensaje(sessionId, n, "user", [{ type: "text", text: texto }]);
}
