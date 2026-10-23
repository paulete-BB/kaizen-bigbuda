import { NextResponse } from "next/server";
import { snapshotResumenListaClientes } from "@/lib/metricas/resumen-lista-clientes";

/**
 * Invocado por el cron de Vercel (`vercel.json`) — guarda el snapshot diario
 * de un solo día (SEO vía GSC, AEO vía GA4) que alimenta las columnas de la
 * lista de `/clientes`. Misma autenticación que los otros crons: header
 * `Authorization` (`Bearer $CRON_SECRET`).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const resultado = await snapshotResumenListaClientes();
  return NextResponse.json({ ok: true, ...resultado });
}
