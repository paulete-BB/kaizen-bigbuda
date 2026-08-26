import { NextResponse } from "next/server";
import { generarInformesAutomaticos } from "@/lib/informes/auto-generar";

/**
 * Invocado por el cron de Vercel (`vercel.json`) — genera automáticamente
 * los informes mensuales de Ads que ya corresponden (§3.2/§3.4). Misma
 * autenticación que `reintentar-sync`: header `Authorization` (`Bearer
 * $CRON_SECRET`).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const resultado = await generarInformesAutomaticos();
  return NextResponse.json({ ok: true, ...resultado });
}
