import { NextResponse } from "next/server";
import { generarOptimizacionesAds, sincronizarTareasSemanaEnCurso } from "@/lib/data/ads-calendario";

export const maxDuration = 300;

/**
 * Invocado por el cron de Vercel (`vercel.json`): mantiene el calendario
 * semanal de Ads 4 semanas hacia adelante y crea en ClickUp las tareas de la
 * semana en curso. Misma autenticación que los otros crons (`Bearer
 * $CRON_SECRET`).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const generadas = await generarOptimizacionesAds();
  const tareas = await sincronizarTareasSemanaEnCurso();
  return NextResponse.json({ ok: true, ...generadas, tareas });
}
