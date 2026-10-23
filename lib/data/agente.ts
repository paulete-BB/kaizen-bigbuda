import { sql } from "@/lib/db";
import { cargarHistorial, MIN_HISTORIAL } from "@/lib/agente/contexto";
import type { ItemPlan } from "@/lib/agente/tipos";

export interface MensajeVista {
  rol: "user" | "assistant";
  texto: string;
}

export interface AgenteVista {
  optimizationId: string;
  clienteId: string;
  clienteNombre: string;
  tipo: "meta_ads" | "google_ads";
  fechaProgramada: string;
  estadoOptimizacion: string;
  sesion: {
    id: string;
    estado: "en_curso" | "cerrada";
    plan: ItemPlan[];
    resumenBorrador: string;
    hallazgosBorrador: string;
    /** El primer mensaje (contexto armado por la plataforma) va aparte, no como burbuja de chat. */
    contexto: string;
    mensajes: MensajeVista[];
    historialPrevio: number;
    minHistorial: number;
  } | null;
}

type Bloque = { type: string; text?: string };

function textoDe(contenido: unknown): string {
  if (!Array.isArray(contenido)) return typeof contenido === "string" ? contenido : "";
  return (contenido as Bloque[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n\n")
    .trim();
}

export async function getAgenteVista(optimizationId: string): Promise<AgenteVista | null> {
  const [o] = await sql<{ client_id: string; cliente_nombre: string; tipo: string; fecha_programada: string; estado: string; service_id: string }[]>`
    select o.client_id, c.nombre as cliente_nombre, o.tipo, o.fecha_programada, o.estado, o.service_id
    from optimizations o join clients c on c.id = o.client_id
    where o.id = ${optimizationId}
  `;
  if (!o || o.tipo === "seo_aeo_geo") return null;

  const [s] = await sql<{ id: string; estado: "en_curso" | "cerrada"; plan: ItemPlan[]; resumen_borrador: string | null; hallazgos_borrador: string | null }[]>`
    select id, estado, plan, resumen_borrador, hallazgos_borrador from agent_sessions where optimization_id = ${optimizationId}
  `;

  let sesion: AgenteVista["sesion"] = null;
  if (s) {
    const filas = await sql<{ orden: number; rol: "user" | "assistant"; contenido: unknown }[]>`
      select orden, rol, contenido from agent_messages where session_id = ${s.id} order by orden
    `;
    const historial = await cargarHistorial(o.service_id, optimizationId, 10);
    const contexto = filas[0] ? textoDe(filas[0].contenido) : "";
    const mensajes: MensajeVista[] = [];
    for (const f of filas) {
      if (f.orden === 0) continue;
      const texto = textoDe(f.contenido);
      // Los mensajes de solo herramientas (tool_use / tool_result) no se muestran como burbuja.
      if (texto) mensajes.push({ rol: f.rol, texto });
    }
    sesion = {
      id: s.id,
      estado: s.estado,
      plan: s.plan ?? [],
      resumenBorrador: s.resumen_borrador ?? "",
      hallazgosBorrador: s.hallazgos_borrador ?? "",
      contexto,
      mensajes,
      historialPrevio: historial.length,
      minHistorial: MIN_HISTORIAL,
    };
  }

  return {
    optimizationId,
    clienteId: o.client_id,
    clienteNombre: o.cliente_nombre,
    tipo: o.tipo as "meta_ads" | "google_ads",
    fechaProgramada: o.fecha_programada,
    estadoOptimizacion: o.estado,
    sesion,
  };
}
