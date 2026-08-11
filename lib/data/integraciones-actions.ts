"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export interface ResultadoImportacionConfig {
  ok: boolean;
  error?: string;
  emparejados?: string[];
  sinEmparejar?: string[];
}

interface ClienteExportado {
  name?: string;
  url?: string;
  ga4?: string;
  meta?: string;
  fbpage?: string;
  igpage?: string;
  metaTokenKey?: string;
}

/**
 * Importa la configuración exportada por el dashboard de resultados
 * anterior (`bb_cl` de localStorage, botón "Exportar clientes") — §3.14.
 * Empareja por nombre de cliente (no por URL de GSC, que en el dashboard
 * original podía repetirse vacía entre clientes sin SEO contratado) contra
 * los clientes ya existentes en la plataforma; nunca crea clientes nuevos
 * desde el import, solo completa los campos de integración de los que ya
 * existen, para no duplicar el alta real de un cliente.
 */
export async function importarConfigDashboard(formData: FormData): Promise<ResultadoImportacionConfig> {
  const session = await requireUser();
  if (session.rol !== "admin") return { ok: false, error: "Solo un administrador puede importar configuración." };

  const contenido = String(formData.get("json") ?? "");
  if (!contenido.trim()) return { ok: false, error: "Pegá o subí el JSON exportado." };

  let lista: ClienteExportado[];
  try {
    const parsed = JSON.parse(contenido);
    if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un array de clientes.");
    lista = parsed;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON inválido." };
  }

  const clientesExistentes = await sql<{ id: string; nombre: string }[]>`select id, nombre from clients`;
  const porNombre = new Map(clientesExistentes.map((c) => [c.nombre.trim().toLowerCase(), c.id]));

  const emparejados: string[] = [];
  const sinEmparejar: string[] = [];

  for (const entrada of lista) {
    const nombre = (entrada.name ?? "").trim();
    if (!nombre) continue;
    const clientId = porNombre.get(nombre.toLowerCase());
    if (!clientId) {
      sinEmparejar.push(nombre);
      continue;
    }

    const metaAdAccountId = entrada.meta ? entrada.meta.replace(/^act_/, "") : null;
    const metaTokenKey = entrada.metaTokenKey
      ? entrada.metaTokenKey.toUpperCase().replace(/[^A-Z0-9_]/g, "")
      : null;

    await sql`
      update clients set
        gsc_property = ${entrada.url || null},
        ga4_property_id = ${entrada.ga4 || null},
        meta_ad_account_id = ${metaAdAccountId},
        fb_page_id = ${entrada.fbpage || null},
        ig_account_id = ${entrada.igpage || null},
        meta_token_key = ${metaTokenKey}
      where id = ${clientId}
    `;
    emparejados.push(nombre);
  }

  revalidatePath("/clientes");
  return { ok: true, emparejados, sinEmparejar };
}
