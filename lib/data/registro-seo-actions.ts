"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { syncLogEntryToClickUp, syncOptimizationTaskToClickUp } from "@/lib/clickup/client";

export async function toggleChecklistItemSeo(formData: FormData) {
  await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const optimizationId = String(formData.get("optimizationId") ?? "");
  if (!itemId) return;
  await sql`
    update checklist_items
    set estado = (case when estado = 'completado' then 'pendiente' else 'completado' end)::checklist_item_estado
    where id = ${itemId}
  `;
  revalidatePath(`/optimizaciones/${optimizationId}/registro`);
}

export async function guardarRegistroSeo(formData: FormData) {
  const session = await requireUser();
  const optimizationId = String(formData.get("optimizationId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const resumen = String(formData.get("resumen") ?? "");
  const hallazgos = String(formData.get("hallazgos") ?? "");
  const proximosPasos = String(formData.get("proximosPasos") ?? "");
  const proximaFecha = String(formData.get("proximaFecha") ?? "");
  const informeEnviado = formData.get("informeEnviado") === "on";
  const fechaInforme = String(formData.get("fechaInforme") ?? "");
  const responsableId = String(formData.get("responsableId") ?? "") || null;
  if (!optimizationId) return;

  await sql`
    update optimizations set
      estado = 'realizada',
      fecha_realizada = current_date,
      resumen = ${resumen},
      hallazgos = ${hallazgos || null},
      proximos_pasos = ${proximosPasos},
      proxima_fecha = ${proximaFecha || null},
      informe_enviado_en = ${informeEnviado ? fechaInforme || null : null}
    where id = ${optimizationId}
  `;

  const contenido = [
    `Realizado: ${resumen}`,
    hallazgos ? `Hallazgos: ${hallazgos}` : null,
    `Próximos pasos: ${proximosPasos}`,
    `Próxima optimización: ${proximaFecha}`,
    `Informe: ${informeEnviado ? `enviado el ${fechaInforme}` : "pendiente"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sync = await syncLogEntryToClickUp({
    clientId,
    fecha: new Date().toISOString().slice(0, 10),
    titulo: "Optimización SEO · AEO · GEO",
    tipo: "Optimización",
    contenido,
  });

  await sql`
    insert into log_entries (client_id, optimization_id, titulo, tipo, contenido, sync_status, creado_por)
    values (${clientId}, ${optimizationId}, 'Optimización SEO · AEO · GEO', 'Optimización', ${contenido}, ${sync.ok ? "ok" : "pendiente_sync"}, ${session.userId})
  `;

  if (proximaFecha) {
    const [{ id: proximaOptimizationId }] = await sql<{ id: string }[]>`
      insert into optimizations (client_id, service_id, tipo, fecha_programada, responsable_id, estado, sync_status)
      values (${clientId}, ${serviceId}, 'seo_aeo_geo', ${proximaFecha}, ${responsableId}, 'programada', 'pendiente_sync')
      returning id
    `;
    await syncOptimizationTaskToClickUp({
      optimizationId: proximaOptimizationId,
      clientId,
      serviceId,
      servicioTipo: "seo_aeo_geo",
      fechaProgramada: proximaFecha,
      responsableId,
    });
  }

  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}`);
}
