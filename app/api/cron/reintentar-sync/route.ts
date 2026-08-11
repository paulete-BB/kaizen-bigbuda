import { NextResponse } from "next/server";
import { reintentarSyncPendiente } from "@/lib/clickup/retry";

/**
 * Invocado por el cron de Vercel (`vercel.json`) — ver §4.3, job de
 * reintento de `pendiente_sync`. Autenticación: header `Authorization`
 * (`Bearer $CRON_SECRET`), que Vercel agrega solo cuando el env var
 * `CRON_SECRET` existe en el proyecto — https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const resultado = await reintentarSyncPendiente();
  return NextResponse.json({ ok: true, ...resultado });
}
