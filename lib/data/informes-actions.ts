"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { hoySantiago } from "@/lib/dates";
import { syncLogEntryToClickUp } from "@/lib/clickup/client";
import {
  contenidoMarketingVacio,
  contenidoSeoVacio,
  fmtMesAnio,
  type InformeMarketingContenido,
  type InformeSeoContenido,
} from "@/lib/informes/tipos";
import type { ServicioTipo } from "@/lib/data/cliente-detalle";

export interface AccionInformeResultado {
  ok: boolean;
  error?: string;
}

const TIPO_LABEL: Record<ServicioTipo, string> = {
  seo_aeo_geo: "SEO · AEO · GEO",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

function esFormatoAds(tipo: ServicioTipo) {
  return tipo === "meta_ads" || tipo === "google_ads";
}

/** Pre-llena "Inversión del mes" desde `budgets` si existe una fila para ese servicio/período — reemplaza el ingreso manual cuando el dato ya se registró en el bloque de miércoles (§3.9). */
async function prellenarInversionDelMes(serviceId: string, mes: number, anio: number): Promise<InformeMarketingContenido["inversionDelMes"] | null> {
  const [budget] = await sql<
    { presupuesto: string; moneda: string; gasto_acumulado: string; pacing_pct: string | null; alerta_disparada: boolean }[]
  >`select presupuesto, moneda, gasto_acumulado, pacing_pct, alerta_disparada from budgets where service_id = ${serviceId} and mes = ${mes} and anio = ${anio}`;
  if (!budget) return null;

  const presupuesto = Number(budget.presupuesto);
  const gasto = Number(budget.gasto_acumulado);
  const pacingPct = budget.pacing_pct ? Number(budget.pacing_pct) : presupuesto > 0 ? (gasto / presupuesto) * 100 : 0;
  const fmtMoneda = (n: number) => `${n.toLocaleString("es-CL")} ${budget.moneda}`;

  const hoy = hoySantiago();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const diaMes = esMesActual ? hoy.getDate() : diasDelMes;
  const pctMesTranscurrido = Math.round((diaMes / diasDelMes) * 1000) / 10;

  return {
    presupuesto: fmtMoneda(presupuesto),
    gasto: fmtMoneda(gasto),
    diaMes: String(diaMes),
    pctMesTranscurrido: `${pctMesTranscurrido}%`,
    pctEjecutado: `${Math.round(pacingPct * 10) / 10}%`,
    estado: !budget.alerta_disparada ? "dentro_rango" : pacingPct > 100 ? "sobregasto" : "subgasto",
    nota: "",
  };
}

/** Pre-llena "¿Qué mejoramos?" con los resúmenes de la bitácora del período — texto crudo, el equipo condensa (§3.4). */
async function prellenarAccionesDesdeBitacora(serviceId: string, mes: number, anio: number): Promise<InformeMarketingContenido["queMejoramos"]["acciones"]> {
  const rows = await sql<{ resumen: string }[]>`
    select resumen from optimizations
    where service_id = ${serviceId} and resumen is not null and resumen != ''
      and extract(year from fecha_realizada) = ${anio} and extract(month from fecha_realizada) = ${mes}
    order by fecha_realizada
  `;
  return rows.map((r) => ({ accion: r.resumen, efecto: "" }));
}

/**
 * Crea un borrador nuevo, o lo duplica desde otro informe (§3.4: "duplicar
 * informe del mes anterior como base"). Idempotente respecto al índice
 * único (client_id, tipo, periodo_mes, periodo_anio): si ya existe,
 * redirige al existente en vez de fallar o duplicar.
 */
export async function crearInforme(formData: FormData): Promise<void> {
  await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as ServicioTipo;
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const duplicarDeId = String(formData.get("duplicarDeId") ?? "") || null;
  if (!clientId || !tipo || !periodoMes || !periodoAnio) return;

  const [existente] = await sql<{ id: string }[]>`
    select id from reports where client_id = ${clientId} and tipo = ${tipo} and periodo_mes = ${periodoMes} and periodo_anio = ${periodoAnio}
  `;
  if (existente) redirect(`/informes/${existente.id}`);

  const [servicio] = await sql<{ id: string }[]>`select id from services where client_id = ${clientId} and tipo = ${tipo}`;
  const serviceId = servicio?.id ?? null;

  let contenido: InformeSeoContenido | InformeMarketingContenido;
  if (duplicarDeId) {
    const [origen] = await sql<{ contenido_json: InformeSeoContenido | InformeMarketingContenido }[]>`
      select contenido_json from reports where id = ${duplicarDeId} and client_id = ${clientId} and tipo = ${tipo}
    `;
    contenido = origen ? origen.contenido_json : esFormatoAds(tipo) ? contenidoMarketingVacio() : contenidoSeoVacio();
  } else if (esFormatoAds(tipo) && serviceId) {
    const marketing = contenidoMarketingVacio();
    const [inversion, acciones] = await Promise.all([
      prellenarInversionDelMes(serviceId, periodoMes, periodoAnio),
      prellenarAccionesDesdeBitacora(serviceId, periodoMes, periodoAnio),
    ]);
    if (inversion) marketing.inversionDelMes = inversion;
    if (acciones.length > 0) marketing.queMejoramos.acciones = acciones;
    contenido = marketing;
  } else {
    contenido = esFormatoAds(tipo) ? contenidoMarketingVacio() : contenidoSeoVacio();
  }

  const [creado] = await sql<{ id: string }[]>`
    insert into reports (client_id, service_id, tipo, periodo_mes, periodo_anio, contenido_json)
    values (${clientId}, ${serviceId}, ${tipo}, ${periodoMes}, ${periodoAnio}, ${sql.json(contenido as unknown as Parameters<typeof sql.json>[0])})
    returning id
  `;
  revalidatePath(`/clientes/${clientId}/informes`);
  redirect(`/informes/${creado.id}`);
}

export async function guardarContenidoInforme(reportId: string, contenido: InformeSeoContenido | InformeMarketingContenido): Promise<AccionInformeResultado> {
  await requireUser();
  const [reporte] = await sql<{ estado: string; client_id: string }[]>`select estado, client_id from reports where id = ${reportId}`;
  if (!reporte) return { ok: false, error: "Informe no encontrado." };
  if (reporte.estado === "enviado") return { ok: false, error: "Este informe ya se envió y no se puede editar." };

  await sql`update reports set contenido_json = ${sql.json(contenido as unknown as Parameters<typeof sql.json>[0])}, actualizado_en = now() where id = ${reportId}`;
  revalidatePath(`/informes/${reportId}`);
  return { ok: true };
}

export async function cambiarEstadoInforme(formData: FormData): Promise<AccionInformeResultado> {
  await requireUser();
  const reportId = String(formData.get("reportId") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (estado !== "borrador" && estado !== "listo") return { ok: false, error: "Estado inválido." };

  const [reporte] = await sql<{ estado: string }[]>`select estado from reports where id = ${reportId}`;
  if (!reporte) return { ok: false, error: "Informe no encontrado." };
  if (reporte.estado === "enviado") return { ok: false, error: "Este informe ya se envió." };

  await sql`update reports set estado = ${estado}, actualizado_en = now() where id = ${reportId}`;
  revalidatePath(`/informes/${reportId}`);
  return { ok: true };
}

/** Registra el envío (§3.4) y lo deja en la bitácora del cliente — igual que el registro de una optimización. */
export async function registrarEnvioInforme(formData: FormData): Promise<AccionInformeResultado> {
  const session = await requireUser();
  const reportId = String(formData.get("reportId") ?? "");
  const medio = String(formData.get("medio") ?? "").trim();
  const destinatario = String(formData.get("destinatario") ?? "").trim();
  if (!medio || !destinatario) return { ok: false, error: "Completa medio y destinatario." };

  const [reporte] = await sql<{ client_id: string; tipo: ServicioTipo; periodo_mes: number; periodo_anio: number; estado: string }[]>`
    select client_id, tipo, periodo_mes, periodo_anio, estado from reports where id = ${reportId}
  `;
  if (!reporte) return { ok: false, error: "Informe no encontrado." };
  if (reporte.estado === "enviado") return { ok: false, error: "Este informe ya se envió." };

  await sql`
    update reports set estado = 'enviado', enviado_en = now(), enviado_por = ${session.userId}, destinatario = ${destinatario}
    where id = ${reportId}
  `;

  const periodoLabel = fmtMesAnio(reporte.periodo_mes, reporte.periodo_anio);
  const contenidoBitacora = `Informe enviado: ${TIPO_LABEL[reporte.tipo]} — ${periodoLabel}. Medio: ${medio}. Destinatario: ${destinatario}.`;
  const sync = await syncLogEntryToClickUp({
    clientId: reporte.client_id,
    fecha: new Date().toISOString().slice(0, 10),
    titulo: `Informe enviado — ${TIPO_LABEL[reporte.tipo]}`,
    tipo: "Informe",
    contenido: contenidoBitacora,
  });
  await sql`
    insert into log_entries (client_id, report_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${reporte.client_id}, ${reportId}, ${`Informe enviado — ${TIPO_LABEL[reporte.tipo]}`}, 'Informe', ${contenidoBitacora}, ${sync.ok ? "ok" : "pendiente_sync"}, ${session.userId})
  `;

  revalidatePath(`/informes/${reportId}`);
  revalidatePath(`/clientes/${reporte.client_id}/informes`);
  return { ok: true };
}
