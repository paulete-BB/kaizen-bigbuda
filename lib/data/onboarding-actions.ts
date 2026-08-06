"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { hoySantiago, toIso } from "@/lib/dates";
import { syncOptimizationTaskToClickUp } from "@/lib/clickup/client";
import { asignarViernesOrdinal, generarOptimizacionesSeoDelMes } from "@/lib/scheduling/seo";
import { generarOptimizacionesAdsDelMes } from "@/lib/scheduling/ads";
import type { Holiday, OptimizacionGenerada, ServicioActivo, ServicioTipo } from "@/lib/scheduling/types";

export async function toggleOnboardingItem(formData: FormData) {
  const session = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!itemId || !clientId) return;

  await sql`
    update checklist_items
    set estado = (case when estado in ('recibido', 'completado') then 'pendiente' else 'completado' end)::checklist_item_estado
    where id = ${itemId}
  `;

  await activarPrimeraOptimizacionSiCorresponde(clientId, session.userId);
  revalidatePath(`/clientes/${clientId}`);
}

/**
 * Cada generador (SEO/Ads) devuelve las fechas de UN mes; si ya pasaron
 * todas las de este mes (onboarding se completó tarde), busca en los
 * próximos meses hasta encontrar la primera fecha desde hoy.
 */
async function primeraFechaDesdeHoy(
  servicio: ServicioActivo,
  generador: (servicios: ServicioActivo[], holidays: Holiday[], year: number, month: number) => { optimizaciones: OptimizacionGenerada[] },
): Promise<OptimizacionGenerada | undefined> {
  const hoy = hoySantiago();
  const hoyIso = toIso(hoy);
  let year = hoy.getFullYear();
  let month = hoy.getMonth() + 1;

  for (let intentos = 0; intentos < 3; intentos++) {
    const holidays = await sql<Holiday[]>`select fecha, nombre from holidays where anio = ${year}`;
    const { optimizaciones } = generador([servicio], holidays, year, month);
    const candidatas = optimizaciones
      .filter((o) => o.fechaProgramada >= hoyIso)
      .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada));
    if (candidatas.length) return candidatas[0];
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year++;
  }
  return undefined;
}

/**
 * §3.8 — la primera optimización de un servicio no se programa hasta que
 * los ítems bloqueantes del onboarding estén completos. Se llama tras cada
 * toggle: si ya no quedan bloqueantes pendientes, programa la primera
 * optimización de cada servicio del cliente que todavía no tenga ninguna.
 */
async function activarPrimeraOptimizacionSiCorresponde(clientId: string, actorId: string) {
  const [{ pendientes }] = await sql<{ pendientes: string }[]>`
    select count(*) as pendientes
    from checklist_items ci
    join checklist_instances inst on inst.id = ci.instance_id
    left join checklist_items_template cit on cit.template_id = inst.template_id and cit.orden = ci.orden
    where inst.client_id = ${clientId}
      and inst.template_id in (select id from checklist_templates where tipo = 'onboarding')
      and coalesce(cit.bloqueante, false)
      and ci.estado not in ('recibido', 'completado')
  `;
  if (Number(pendientes) > 0) return;

  const servicios = await sql<
    { id: string; tipo: ServicioTipo; responsable_id: string | null }[]
  >`
    select s.id, s.tipo, s.responsable_id
    from services s
    where s.client_id = ${clientId} and not s.pausado
      and not exists (select 1 from optimizations o where o.service_id = s.id)
  `;
  if (servicios.length === 0) return;

  const generadas: { fecha: string; tipoLabel: string }[] = [];

  const seoNuevos = servicios.filter((s) => s.tipo === "seo_aeo_geo");
  if (seoNuevos.length) {
    const seoExistentes = await sql<{ id: string; client_id: string; viernes_ordinal_asignado: number }[]>`
      select id, client_id, viernes_ordinal_asignado from services
      where tipo = 'seo_aeo_geo' and not pausado and viernes_ordinal_asignado is not null
    `;
    const universo: ServicioActivo[] = [
      ...seoExistentes.map((s) => ({ id: s.id, clientId: s.client_id, tipo: "seo_aeo_geo" as const, viernesOrdinalAsignado: s.viernes_ordinal_asignado })),
      ...seoNuevos.map((s) => ({ id: s.id, clientId, tipo: "seo_aeo_geo" as const, viernesOrdinalAsignado: null, responsableId: s.responsable_id })),
    ];
    const { asignaciones } = asignarViernesOrdinal(universo);

    for (const s of seoNuevos) {
      const ordinal = asignaciones.find((a) => a.serviceId === s.id)?.ordinal;
      if (!ordinal) continue; // sin cupo este mes — queda para redistribución manual del admin
      await sql`update services set viernes_ordinal_asignado = ${ordinal} where id = ${s.id}`;

      const opt = await primeraFechaDesdeHoy(
        { id: s.id, clientId, tipo: "seo_aeo_geo", viernesOrdinalAsignado: ordinal, responsableId: s.responsable_id },
        generarOptimizacionesSeoDelMes,
      );
      if (!opt) continue;
      const [{ id: optimizationId }] = await sql<{ id: string }[]>`
        insert into optimizations (client_id, service_id, tipo, fecha_programada, responsable_id, estado, sync_status)
        values (${clientId}, ${s.id}, 'seo_aeo_geo', ${opt.fechaProgramada}, ${s.responsable_id}, 'programada', 'pendiente_sync')
        returning id
      `;
      await syncOptimizationTaskToClickUp({
        optimizationId,
        clientId,
        serviceId: s.id,
        servicioTipo: "seo_aeo_geo",
        fechaProgramada: opt.fechaProgramada,
        responsableId: s.responsable_id,
      });
      generadas.push({ fecha: opt.fechaProgramada, tipoLabel: "SEO · AEO · GEO" });
    }
  }

  for (const s of servicios.filter((s) => s.tipo !== "seo_aeo_geo")) {
    const opt = await primeraFechaDesdeHoy({ id: s.id, clientId, tipo: s.tipo, responsableId: s.responsable_id }, generarOptimizacionesAdsDelMes);
    if (!opt) continue;
    const [{ id: optimizationId }] = await sql<{ id: string }[]>`
      insert into optimizations (client_id, service_id, tipo, fecha_programada, hora_programada, responsable_id, estado, sync_status)
      values (${clientId}, ${s.id}, ${s.tipo}, ${opt.fechaProgramada}, ${opt.horaProgramada ?? null}, ${s.responsable_id}, 'programada', 'pendiente_sync')
      returning id
    `;
    await syncOptimizationTaskToClickUp({
      optimizationId,
      clientId,
      serviceId: s.id,
      servicioTipo: s.tipo,
      fechaProgramada: opt.fechaProgramada,
      horaProgramada: opt.horaProgramada ?? null,
      responsableId: s.responsable_id,
    });
    generadas.push({ fecha: opt.fechaProgramada, tipoLabel: s.tipo === "meta_ads" ? "Meta Ads" : "Google Ads" });
  }

  if (generadas.length) {
    const resumen = generadas.map((g) => `${g.tipoLabel}: ${g.fecha}`).join(" · ");
    await sql`
      insert into log_entries (client_id, titulo, tipo, contenido, sync_status, creado_por)
      values (${clientId}, 'Onboarding completado', 'Onboarding', ${"Ítems bloqueantes listos. Primera optimización programada — " + resumen}, 'pendiente_sync', ${actorId})
    `;
  }
}
