import { NextResponse } from "next/server";
import { rechazarSinLlave, SIN_CACHE } from "@/lib/auth/api-lectura";
import { getCarteraAds } from "@/lib/data/mi-dia";

export const dynamic = "force-dynamic";

/** GET /api/lectura/cartera — estado de cada servicio de Ads activo (semáforo, motivos, cifras de ayer, pendientes). De la base, sin llamadas en vivo. */
export async function GET(req: Request) {
  const rechazo = rechazarSinLlave(req);
  if (rechazo) return rechazo;
  try {
    return NextResponse.json({ ok: true, cartera: await getCarteraAds() }, { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
