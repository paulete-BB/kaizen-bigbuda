import { NextResponse } from "next/server";
import { snapshotConversionesAyer } from "@/lib/metricas/conversiones-ayer";

/**
 * Invocado por el cron de Vercel (`vercel.json`) — guarda el snapshot diario
 * de conversiones de "ayer" por servicio de Ads (alimenta la alerta "sin
 * conversiones ayer" del dashboard). Misma autenticación que los otros dos
 * crons: header `Authorization` (`Bearer $CRON_SECRET`).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const resultado = await snapshotConversionesAyer();
  return NextResponse.json({ ok: true, ...resultado });
}
