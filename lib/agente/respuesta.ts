import { z } from "zod";
import type { ItemPlan } from "@/lib/agente/tipos";

// Parser de la respuesta que la persona pega desde Claude en el modo manual.
// El briefing le pide a Claude un formato fijo (## RESUMEN / ## HALLAZGOS /
// ## PLAN con un bloque json); el parser es tolerante: cualquier sección que
// falte se ignora y solo falla si no hay nada aprovechable.

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ItemSchema = z.object({
  id: z.string().min(1).max(40),
  prioridad: z.enum(["alta", "media", "baja"]),
  tipo: z.enum(["accion", "esperar_datos", "revisar"]),
  titulo: z.string().min(3).max(140),
  detalle: z.string().min(3).max(1200),
  revisarEn: Fecha.nullish(),
});

export interface RespuestaParseada {
  resumen: string;
  hallazgos: string;
  plan: Omit<ItemPlan, "estado">[];
  avisos: string[];
}

// Los títulos pueden venir con o sin "##" (al copiar desde el chat de Claude los # suelen perderse), con
// negrita o con ":" al final; la línea debe ser solo el título para no confundir una frase que empiece igual.
const TITULO = (nombre: string) => `^[#*\\s]*${nombre}[*:\\s]*$`;
const CUALQUIER_TITULO = `${TITULO("(?:RESUMEN|HALLAZGOS|PLAN)")}`;

function seccion(texto: string, nombre: string): string {
  const re = new RegExp(`${TITULO(nombre)}\\n([\\s\\S]*?)(?=${CUALQUIER_TITULO}|(?![\\s\\S]))`, "im");
  return (texto.match(re)?.[1] ?? "").replace(/```[\s\S]*?```/g, "").trim();
}

export function parsearRespuestaClaude(texto: string): RespuestaParseada | { error: string } {
  const avisos: string[] = [];
  const resumen = seccion(texto, "RESUMEN");
  const hallazgos = seccion(texto, "HALLAZGOS");

  let plan: RespuestaParseada["plan"] = [];
  const planSeccion = texto.match(new RegExp(`${TITULO("PLAN")}\\n([\\s\\S]*)$`, "im"))?.[1] ?? texto;
  const bloque = planSeccion.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (bloque) {
    try {
      const crudo = JSON.parse(bloque) as unknown;
      const lista = Array.isArray(crudo) ? crudo : (crudo as { items?: unknown })?.items;
      const r = z.array(ItemSchema).max(12).safeParse(lista);
      if (r.success) {
        const vistos = new Set<string>();
        plan = r.data
          .filter((it) => !vistos.has(it.id) && vistos.add(it.id))
          .map((it) => ({ ...it, revisarEn: it.revisarEn ?? null }));
      } else {
        avisos.push("El bloque del plan no tiene el formato esperado; no se cargó el plan.");
      }
    } catch {
      avisos.push("El bloque del plan no es un JSON válido; no se cargó el plan.");
    }
  }

  if (!resumen && plan.length === 0) {
    return { error: "No encontré un RESUMEN ni un PLAN en el texto. Pega la respuesta completa de Claude con el formato pedido." };
  }
  if (!resumen) avisos.push("No venía la sección RESUMEN: escríbela a mano antes de cerrar.");
  return { resumen, hallazgos, plan, avisos };
}
