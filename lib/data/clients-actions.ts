"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { addMeses } from "@/lib/dates";

const TIPOS_SERVICIO = ["seo_aeo_geo", "meta_ads", "google_ads"] as const;

export interface CrearClienteResultado {
  ok: boolean;
  error?: string;
}

/**
 * Alta de cliente (§3.1): crea el cliente y sus servicios iniciales. No
 * programa ninguna optimización todavía — eso lo dispara
 * `activarPrimeraOptimizacionSiCorresponde` (lib/data/onboarding-actions.ts)
 * una vez que los ítems bloqueantes del onboarding estén completos. El
 * checklist de onboarding se instancia solo al abrir la ficha del cliente
 * por primera vez (mismo patrón perezoso que ya usa getOnboardingCliente).
 */
export async function crearCliente(formData: FormData): Promise<CrearClienteResultado> {
  await requireUser();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const contactoNombre = String(formData.get("contactoNombre") ?? "").trim();
  const contactoEmail = String(formData.get("contactoEmail") ?? "").trim();
  const contactoTelefono = String(formData.get("contactoTelefono") ?? "").trim();
  const sitioWeb = String(formData.get("sitioWeb") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();

  if (!nombre || !empresa || !contactoNombre || !contactoEmail) {
    return { ok: false, error: "Nombre, empresa, contacto y email son obligatorios." };
  }

  const serviciosSeleccionados = TIPOS_SERVICIO.filter((t) => formData.get(`servicio_${t}`) === "on");
  if (serviciosSeleccionados.length === 0) {
    return { ok: false, error: "Selecciona al menos un servicio para activar." };
  }

  const [cliente] = await sql<{ id: string }[]>`
    insert into clients (nombre, empresa, contacto_nombre, contacto_email, contacto_telefono, sitio_web, industria, estado)
    values (${nombre}, ${empresa}, ${contactoNombre}, ${contactoEmail}, ${contactoTelefono || null}, ${sitioWeb || null}, ${industria || null}, 'activo')
    returning id
  `;

  const hoy = new Date().toISOString().slice(0, 10);
  for (const tipo of serviciosSeleccionados) {
    const fechaInicio = String(formData.get(`fechaInicio_${tipo}`) ?? "") || hoy;
    const periodoMeses = Number(formData.get(`periodoMeses_${tipo}`) ?? 0) || null;
    const responsableId = String(formData.get(`responsable_${tipo}`) ?? "") || null;
    const esAds = tipo !== "seo_aeo_geo";
    const presupuesto = esAds ? Number(formData.get(`presupuesto_${tipo}`) ?? 0) || null : null;
    const moneda = esAds ? String(formData.get(`moneda_${tipo}`) ?? "CLP") : null;
    const fechaTermino = periodoMeses ? addMeses(fechaInicio, periodoMeses) : null;

    await sql`
      insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, presupuesto_mensual, moneda, responsable_id)
      values (${cliente.id}, ${tipo}, ${fechaInicio}, ${periodoMeses}, ${fechaTermino}, ${presupuesto}, ${moneda}, ${responsableId})
    `;
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function extenderServicio(formData: FormData) {
  const session = await requireUser();
  const serviceId = String(formData.get("serviceId") ?? "");
  const nuevaFecha = String(formData.get("nuevaFecha") ?? "");
  const notas = String(formData.get("notas") ?? "").trim();
  if (!serviceId || !nuevaFecha) return;

  await sql`
    insert into service_renewals (service_id, nueva_fecha_termino, notas, creado_por)
    values (${serviceId}, ${nuevaFecha}, ${notas || null}, ${session.userId})
  `;
  await sql`update services set fecha_termino = ${nuevaFecha} where id = ${serviceId}`;
  revalidatePath("/clientes");
}

export async function agregarDescuento(formData: FormData) {
  await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const valor = Number(formData.get("valor") ?? 0);
  const fechaTermino = String(formData.get("fechaTermino") ?? "");
  const esProrroga = formData.get("esProrroga") === "on";
  if (!clientId || !descripcion || !fechaTermino) return;

  if (esProrroga) {
    const [ultimo] = await sql<{ id: string }[]>`
      select id from discounts where client_id = ${clientId} order by creado_en desc limit 1
    `;
    if (ultimo) {
      await sql`update discounts set fecha_termino = ${fechaTermino} where id = ${ultimo.id}`;
      revalidatePath("/clientes");
      return;
    }
  }

  await sql`
    insert into discounts (client_id, descripcion, tipo, valor, fecha_termino)
    values (${clientId}, ${descripcion}, 'pct', ${valor}, ${fechaTermino})
  `;
  revalidatePath("/clientes");
}

export interface RegistrarSalidaResultado {
  ok: boolean;
  error?: string;
}

export async function registrarSalidaCliente(formData: FormData): Promise<RegistrarSalidaResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false, error: "Cliente inválido." };
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede finalizar un cliente." };
  }
  await sql`update clients set estado = 'finalizado' where id = ${clientId}`;
  revalidatePath("/clientes");
  return { ok: true };
}
