"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncLogEntryToClickUp } from "@/lib/clickup/stub";
import { addMeses, fmtFecha } from "@/lib/dates";
import type { ServicioTipo } from "./cliente-detalle";

const SERVICE_LABEL: Record<ServicioTipo, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

async function registrarBitacora(opts: {
  clientId: string;
  titulo: string;
  tipo: string;
  contenido: string;
  creadoPor: string;
  optimizationId?: string;
}) {
  const sync = await syncLogEntryToClickUp({
    clienteNombre: "",
    fecha: new Date().toISOString().slice(0, 10),
    titulo: opts.titulo,
    tipo: opts.tipo,
    contenido: opts.contenido,
  });
  await sql`
    insert into log_entries (client_id, optimization_id, titulo, tipo, contenido, sync_status, creado_por)
    values (
      ${opts.clientId}, ${opts.optimizationId ?? null}, ${opts.titulo}, ${opts.tipo}, ${opts.contenido},
      ${sync.ok ? "ok" : "pendiente_sync"}, ${opts.creadoPor}
    )
  `;
}

export async function actualizarVigenciaServicio(formData: FormData) {
  const session = await requireUser();
  const serviceId = String(formData.get("serviceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nuevaFecha = String(formData.get("nuevaFecha") ?? "");
  const motivo = String(formData.get("motivo") ?? "Renovación acordada");
  const nombreServicio = String(formData.get("nombreServicio") ?? "el servicio");
  if (!serviceId || !clientId || !nuevaFecha) return;

  const [antes] = await sql<{ fecha_termino: string | null }[]>`select fecha_termino from services where id = ${serviceId}`;

  await sql`
    insert into service_renewals (service_id, nueva_fecha_termino, notas, creado_por)
    values (${serviceId}, ${nuevaFecha}, ${motivo}, ${session.userId})
  `;
  await sql`update services set fecha_termino = ${nuevaFecha} where id = ${serviceId}`;

  await registrarBitacora({
    clientId,
    titulo: `Caducidad de ${nombreServicio} actualizada`,
    tipo: "Cambio de servicio",
    contenido: `${motivo} · de ${antes?.fecha_termino ? fmtFecha(antes.fecha_termino) : "sin fecha"} a ${fmtFecha(nuevaFecha)}.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function guardarNuevoDescuento(formData: FormData) {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const pct = Number(formData.get("pct") ?? 10);
  const vence = String(formData.get("vence") ?? "");
  if (!clientId || !nombre || !vence) return;

  await sql`insert into discounts (client_id, descripcion, tipo, valor, fecha_termino) values (${clientId}, ${nombre}, 'pct', ${pct}, ${vence})`;
  await registrarBitacora({
    clientId,
    titulo: `Descuento nuevo · ${nombre}`,
    tipo: "Descuento",
    contenido: `−${pct}% vigente hasta ${fmtFecha(vence)}.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function editarDescuento(formData: FormData) {
  const session = await requireUser();
  const discountId = String(formData.get("discountId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const pct = Number(formData.get("pct") ?? 0);
  const vence = String(formData.get("vence") ?? "");
  if (!discountId || !clientId || !vence) return;

  const [antes] = await sql<{ fecha_termino: string }[]>`select fecha_termino from discounts where id = ${discountId}`;
  await sql`update discounts set valor = ${pct}, fecha_termino = ${vence} where id = ${discountId}`;
  await registrarBitacora({
    clientId,
    titulo: `${nombre} actualizado`,
    tipo: "Descuento",
    contenido: `Descuento −${pct}% · caducidad de ${antes ? fmtFecha(antes.fecha_termino) : "?"} a ${fmtFecha(vence)}.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export interface AccionDescuentoResultado {
  ok: boolean;
  error?: string;
}

export async function terminarDescuento(formData: FormData): Promise<AccionDescuentoResultado> {
  const session = await requireUser();
  const discountId = String(formData.get("discountId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const pct = String(formData.get("pct") ?? "");
  if (!discountId || !clientId) return { ok: false, error: "Descuento inválido." };
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede terminar un descuento antes de tiempo." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  await sql`update discounts set fecha_termino = ${hoy} where id = ${discountId}`;
  await registrarBitacora({
    clientId,
    titulo: `${nombre} terminado`,
    tipo: "Descuento",
    contenido: `Descuento −${pct}% cerrado antes de su caducidad.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function agregarTareaCliente(formData: FormData) {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const destino = String(formData.get("destino") ?? "checklist") as "checklist" | "recurrente";
  const frecuencia = String(formData.get("frecuencia") ?? "");
  const servicioTipo = String(formData.get("servicioTipo") ?? "seo_aeo_geo");
  const responsableId = String(formData.get("responsableId") ?? "");
  const proximaOptimizacion = String(formData.get("proximaOptimizacion") ?? "");
  if (!clientId || !titulo) return;

  await sql`
    insert into client_tasks (client_id, titulo, destino, frecuencia, servicio_tipo, responsable_id)
    values (${clientId}, ${titulo}, ${destino}, ${destino === "recurrente" ? frecuencia : null}, ${servicioTipo}, ${responsableId || null})
  `;
  await registrarBitacora({
    clientId,
    titulo: `Tarea agregada · ${titulo}`,
    tipo: destino === "checklist" ? "Checklist" : "Recurrente",
    contenido:
      destino === "checklist"
        ? `Queda en el checklist de la próxima optimización (${proximaOptimizacion}).`
        : `Queda como tarea recurrente · ${frecuencia}.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function eliminarTareaCliente(formData: FormData) {
  await requireUser();
  const tareaId = String(formData.get("tareaId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!tareaId) return;
  await sql`delete from client_tasks where id = ${tareaId}`;
  revalidatePath(`/clientes/${clientId}`);
}

export interface EditarClienteResultado {
  ok: boolean;
  error?: string;
}

export async function editarCliente(formData: FormData): Promise<EditarClienteResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const contactoNombre = String(formData.get("contactoNombre") ?? "").trim();
  const contactoEmail = String(formData.get("contactoEmail") ?? "").trim();
  const contactoTelefono = String(formData.get("contactoTelefono") ?? "").trim();
  const sitioWeb = String(formData.get("sitioWeb") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  if (!clientId) return { ok: false, error: "Cliente inválido." };
  if (!nombre || !empresa || !contactoNombre || !contactoEmail) {
    return { ok: false, error: "Nombre, empresa, contacto y email son obligatorios." };
  }

  await sql`
    update clients set
      nombre = ${nombre}, empresa = ${empresa}, contacto_nombre = ${contactoNombre},
      contacto_email = ${contactoEmail}, contacto_telefono = ${contactoTelefono || null},
      sitio_web = ${sitioWeb || null}, industria = ${industria || null}
    where id = ${clientId}
  `;
  await registrarBitacora({
    clientId,
    titulo: "Datos del cliente actualizados",
    tipo: "Cliente",
    contenido: `${nombre} · ${empresa} · ${contactoNombre} (${contactoEmail}).`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  return { ok: true };
}

export interface AgregarServicioResultado {
  ok: boolean;
  error?: string;
}

export async function agregarServicio(formData: FormData): Promise<AgregarServicioResultado> {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as ServicioTipo;
  const fechaInicio = String(formData.get("fechaInicio") ?? "") || new Date().toISOString().slice(0, 10);
  const periodoMeses = Number(formData.get("periodoMeses") ?? 0) || null;
  const responsableId = String(formData.get("responsableId") ?? "") || null;
  const esAds = tipo !== "seo_aeo_geo";
  const presupuesto = esAds ? Number(formData.get("presupuesto") ?? 0) || null : null;
  const moneda = esAds ? String(formData.get("moneda") ?? "CLP") : null;
  if (!clientId || !tipo) return { ok: false, error: "Faltan datos del servicio." };

  const [existente] = await sql<{ id: string }[]>`select id from services where client_id = ${clientId} and tipo = ${tipo}`;
  if (existente) return { ok: false, error: `Este cliente ya tuvo el servicio ${SERVICE_LABEL[tipo] ?? tipo} — reactívalo en vez de crearlo de nuevo.` };

  const fechaTermino = periodoMeses ? addMeses(fechaInicio, periodoMeses) : null;
  await sql`
    insert into services (client_id, tipo, fecha_inicio, periodo_meses, fecha_termino, presupuesto_mensual, moneda, responsable_id)
    values (${clientId}, ${tipo}, ${fechaInicio}, ${periodoMeses}, ${fechaTermino}, ${presupuesto}, ${moneda}, ${responsableId})
  `;
  await registrarBitacora({
    clientId,
    titulo: `Servicio agregado · ${SERVICE_LABEL[tipo] ?? tipo}`,
    tipo: "Servicio",
    contenido: `Activo desde ${fmtFecha(fechaInicio)}. El onboarding se instancia al abrir la ficha; la primera optimización se programa cuando esté completo.`,
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function pausarServicio(formData: FormData) {
  const session = await requireUser();
  const serviceId = String(formData.get("serviceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nombreServicio = String(formData.get("nombreServicio") ?? "el servicio");
  if (!serviceId || !clientId) return;

  await sql`update services set pausado = true where id = ${serviceId}`;
  await registrarBitacora({
    clientId,
    titulo: `${nombreServicio} pausado`,
    tipo: "Servicio",
    contenido: "Servicio pausado — deja de programar optimizaciones nuevas hasta que se reactive.",
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function reactivarServicio(formData: FormData) {
  const session = await requireUser();
  const serviceId = String(formData.get("serviceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nombreServicio = String(formData.get("nombreServicio") ?? "el servicio");
  if (!serviceId || !clientId) return;

  await sql`update services set pausado = false where id = ${serviceId}`;
  await registrarBitacora({
    clientId,
    titulo: `${nombreServicio} reactivado`,
    tipo: "Servicio",
    contenido: "Servicio reactivado.",
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function eliminarDescuento(formData: FormData): Promise<AccionDescuentoResultado> {
  const session = await requireUser();
  const discountId = String(formData.get("discountId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  if (!discountId || !clientId) return { ok: false, error: "Descuento inválido." };
  if (session.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede eliminar un descuento." };
  }

  await sql`delete from discounts where id = ${discountId}`;
  await registrarBitacora({
    clientId,
    titulo: `${nombre} eliminado`,
    tipo: "Descuento",
    contenido: "Descuento eliminado del registro.",
    creadoPor: session.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
