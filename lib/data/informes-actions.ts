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
import { prellenarAdsDesdeApis, prellenarSeoDesdeApis, type ConfigApisCliente } from "@/lib/informes/prellenado-apis";
import { generarNarrativaMarketing, generarNarrativaSeo } from "@/lib/informes/generacion-ia";
import { getSettings } from "@/lib/data/settings";
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

/** Config de GSC/GA4/Meta del cliente (§3.14) usada para pre-llenar el informe con datos en vivo. */
async function obtenerConfigApisCliente(clientId: string): Promise<ConfigApisCliente> {
  const [cliente] = await sql<
    {
      gsc_property: string | null;
      ga4_property_id: string | null;
      google_ads_ga4_property_id: string | null;
      meta_ad_account_id: string | null;
      meta_token_key: string | null;
    }[]
  >`select gsc_property, ga4_property_id, google_ads_ga4_property_id, meta_ad_account_id, meta_token_key from clients where id = ${clientId}`;
  return {
    gscProperty: cliente?.gsc_property ?? null,
    ga4PropertyId: cliente?.ga4_property_id ?? null,
    googleAdsGa4PropertyId: cliente?.google_ads_ga4_property_id ?? null,
    metaAdAccountId: cliente?.meta_ad_account_id ?? null,
    metaTokenKey: cliente?.meta_token_key ?? null,
  };
}

/**
 * Pre-llena "Inversión del mes" desde `budgets` si existe una fila para
 * ese servicio/período — reemplaza el ingreso manual cuando el dato ya se
 * registró en el bloque de miércoles (§3.9). Si `gastoRealApi` viene con
 * datos (Meta/GA4 en vivo, §3.14), reemplaza el `gasto_acumulado` manual
 * de esa fila para el cálculo de pacing — el presupuesto acordado sigue
 * viniendo de `budgets` porque ninguna API sabe cuánto se pactó con el
 * cliente, solo cuánto se gastó.
 */
async function prellenarInversionDelMes(
  serviceId: string,
  mes: number,
  anio: number,
  gastoRealApi: { valor: number; moneda: string } | null,
): Promise<InformeMarketingContenido["inversionDelMes"] | null> {
  const [budget] = await sql<
    { presupuesto: string; moneda: string; gasto_acumulado: string; pacing_pct: string | null; alerta_disparada: boolean }[]
  >`select presupuesto, moneda, gasto_acumulado, pacing_pct, alerta_disparada from budgets where service_id = ${serviceId} and mes = ${mes} and anio = ${anio}`;
  if (!budget) return null;

  const presupuesto = Number(budget.presupuesto);
  const usaGastoReal = Boolean(gastoRealApi && gastoRealApi.moneda === budget.moneda);
  const gasto = usaGastoReal ? gastoRealApi!.valor : Number(budget.gasto_acumulado);
  const pacingPct = presupuesto > 0 ? (gasto / presupuesto) * 100 : budget.pacing_pct ? Number(budget.pacing_pct) : 0;
  const fmtMoneda = (n: number) => `${n.toLocaleString("es-CL")} ${budget.moneda}`;

  const hoy = hoySantiago();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const diaMes = esMesActual ? hoy.getDate() : diasDelMes;
  const pctMesTranscurrido = Math.round((diaMes / diasDelMes) * 1000) / 10;

  // Si el gasto real de la API reemplazó al manual, el pacing recién calculado
  // ya no coincide necesariamente con `alerta_disparada` (guardado contra el
  // gasto manual en el bloque de miércoles) — se recalcula contra el umbral
  // de settings en vez de confiar en ese booleano desactualizado.
  let alerta = budget.alerta_disparada;
  if (usaGastoReal) {
    const { umbralPacingPct } = await getSettings();
    alerta = Math.abs(pacingPct - 100) >= umbralPacingPct;
  }

  return {
    presupuesto: fmtMoneda(presupuesto),
    gasto: fmtMoneda(gasto),
    diaMes: String(diaMes),
    pctMesTranscurrido: `${pctMesTranscurrido}%`,
    pctEjecutado: `${Math.round(pacingPct * 10) / 10}%`,
    estado: !alerta ? "dentro_rango" : pacingPct > 100 ? "sobregasto" : "subgasto",
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

export interface InformeCreado {
  id: string;
  /** false si ya existía un informe para ese (cliente, tipo, período) y se devolvió ese en vez de crear uno nuevo. */
  creado: boolean;
}

/**
 * Núcleo de la creación de informes — usado tanto por el formulario manual
 * (`crearInforme`, abajo) como por la generación automática (§3.4 → "que se
 * llenen solos"): el hook en `guardarRegistroSeo` para SEO-AEO-GEO (el mismo
 * día que se registra la optimización mensual) y el cron de Ads
 * (`generarInformesAutomaticos`, primera semana del mes). Ninguno de los dos
 * llama `requireUser()` acá — cada llamador resuelve su propia
 * autenticación (sesión de usuario o `CRON_SECRET`).
 *
 * Idempotente respecto al índice único (client_id, tipo, periodo_mes,
 * periodo_anio): si ya existe, devuelve ese id en vez de crear o fallar —
 * así el cron puede correr todos los días sin duplicar informes.
 */
export async function crearInformeInterno(
  clientId: string,
  tipo: ServicioTipo,
  periodoMes: number,
  periodoAnio: number,
  duplicarDeId: string | null,
): Promise<InformeCreado> {
  const [existente] = await sql<{ id: string }[]>`
    select id from reports where client_id = ${clientId} and tipo = ${tipo} and periodo_mes = ${periodoMes} and periodo_anio = ${periodoAnio}
  `;
  if (existente) return { id: existente.id, creado: false };

  const [servicio] = await sql<{ id: string }[]>`select id from services where client_id = ${clientId} and tipo = ${tipo}`;
  const serviceId = servicio?.id ?? null;

  let contenido: InformeSeoContenido | InformeMarketingContenido;
  if (duplicarDeId) {
    const [origen] = await sql<{ contenido_json: InformeSeoContenido | InformeMarketingContenido }[]>`
      select contenido_json from reports where id = ${duplicarDeId} and client_id = ${clientId} and tipo = ${tipo}
    `;
    contenido = origen ? origen.contenido_json : esFormatoAds(tipo) ? contenidoMarketingVacio() : contenidoSeoVacio();
  } else if (esFormatoAds(tipo) && serviceId) {
    const config = await obtenerConfigApisCliente(clientId);
    const marketing = contenidoMarketingVacio();
    const [acciones, ads] = await Promise.all([
      prellenarAccionesDesdeBitacora(serviceId, periodoMes, periodoAnio),
      prellenarAdsDesdeApis(clientId, serviceId, tipo as "meta_ads" | "google_ads", config, periodoMes, periodoAnio),
    ]);
    const inversion = await prellenarInversionDelMes(serviceId, periodoMes, periodoAnio, ads.gastoReal);
    if (inversion) marketing.inversionDelMes = inversion;
    if (acciones.length > 0) marketing.queMejoramos.acciones = acciones;
    if (ads.metricas.length > 0) marketing.comoVamosCifras.metricas = ads.metricas;
    // Asistencia de IA (§3.4, Fase 4): reescribe "¿Qué mejoramos?" en lenguaje
    // de negocio y propone "¿Qué proyectamos?" + el insight — siempre sobre lo
    // ya pre-llenado arriba, nunca en vez de. Degrada a no tocar nada si falla
    // o si ANTHROPIC_API_KEY no está configurada.
    const narrativa = await generarNarrativaMarketing(clientId, serviceId, periodoMes, periodoAnio, fmtMesAnio(periodoMes, periodoAnio), TIPO_LABEL[tipo], marketing);
    contenido = { ...marketing, ...narrativa };
  } else if (!esFormatoAds(tipo) && serviceId) {
    const config = await obtenerConfigApisCliente(clientId);
    const seo = contenidoSeoVacio();
    const prellenado = await prellenarSeoDesdeApis(clientId, serviceId, config, periodoMes, periodoAnio);
    const conNumeros = { ...seo, ...prellenado };
    const narrativa = await generarNarrativaSeo(clientId, serviceId, periodoMes, periodoAnio, fmtMesAnio(periodoMes, periodoAnio), conNumeros);
    contenido = { ...conNumeros, ...narrativa };
  } else {
    contenido = esFormatoAds(tipo) ? contenidoMarketingVacio() : contenidoSeoVacio();
  }

  const [creado] = await sql<{ id: string }[]>`
    insert into reports (client_id, service_id, tipo, periodo_mes, periodo_anio, contenido_json)
    values (${clientId}, ${serviceId}, ${tipo}, ${periodoMes}, ${periodoAnio}, ${sql.json(contenido as unknown as Parameters<typeof sql.json>[0])})
    returning id
  `;
  revalidatePath(`/clientes/${clientId}/informes`);
  return { id: creado.id, creado: true };
}

/** Wrapper del formulario manual "Crear borrador" (ficha de cliente → Informes) sobre `crearInformeInterno`. */
export async function crearInforme(formData: FormData): Promise<void> {
  await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as ServicioTipo;
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const duplicarDeId = String(formData.get("duplicarDeId") ?? "") || null;
  if (!clientId || !tipo || !periodoMes || !periodoAnio) return;

  const { id } = await crearInformeInterno(clientId, tipo, periodoMes, periodoAnio, duplicarDeId);
  redirect(`/informes/${id}`);
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
