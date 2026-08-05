"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

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

export async function registrarSalidaCliente(formData: FormData) {
  await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await sql`update clients set estado = 'finalizado' where id = ${clientId}`;
  revalidatePath("/clientes");
}
