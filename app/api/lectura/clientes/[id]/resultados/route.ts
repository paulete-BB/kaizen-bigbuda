import { NextResponse } from "next/server";
import { rechazarSinLlave, SIN_CACHE } from "@/lib/auth/api-lectura";
import { obtenerResultadosCliente } from "@/lib/data/resultados";
import { parsearRango } from "@/lib/resultados-rango";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/lectura/clientes/{id}/resultados?rango=7|14|28|90|mes — las mismas
 * secciones que la pestaña Resultados (SEO, AEO, Meta Ads, Google Ads) para el rango.
 * Consulta las APIs de Google/Meta en vivo, igual que la pestaña.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rechazo = rechazarSinLlave(req);
  if (rechazo) return rechazo;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "Id de cliente inválido." }, { status: 400 });
  try {
    const rango = parsearRango(new URL(req.url).searchParams.get("rango") ?? undefined);
    const resultados = await obtenerResultadosCliente(id, rango);
    if (!resultados) return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, resultados }, { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
