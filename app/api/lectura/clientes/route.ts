import { NextResponse } from "next/server";
import { rechazarSinLlave, SIN_CACHE } from "@/lib/auth/api-lectura";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/lectura/clientes — clientes con sus servicios. No incluye datos de contacto. */
export async function GET(req: Request) {
  const rechazo = rechazarSinLlave(req);
  if (rechazo) return rechazo;
  try {
    const filas = await sql<
      { id: string; nombre: string; estado: string; industria: string | null; sitio_web: string | null; meta_ad_account_id: string | null; google_ads_customer_id: string | null; servicios: { tipo: string; estado: string; fecha_termino: string | null }[] }[]
    >`
      select c.id, c.nombre, c.estado, c.industria, c.sitio_web, c.meta_ad_account_id, c.google_ads_customer_id,
             coalesce(json_agg(json_build_object('tipo', sv.tipo, 'estado', sv.estado, 'fecha_termino', sv.fecha_termino) order by sv.tipo)
                      filter (where sv.id is not null), '[]') as servicios
      from clients c
      left join services_view sv on sv.client_id = c.id
      group by c.id
      order by c.nombre
    `;
    return NextResponse.json(
      {
        ok: true,
        clientes: filas.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          estado: c.estado,
          industria: c.industria,
          sitioWeb: c.sitio_web,
          servicios: c.servicios,
          conectado: { meta: !!c.meta_ad_account_id, googleAds: !!c.google_ads_customer_id },
        })),
      },
      { headers: SIN_CACHE },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
