"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export async function agendarReunion(formData: FormData) {
  const session = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "") || null;
  if (!clientId || !titulo || !fecha) return;

  await sql`
    insert into meetings (client_id, titulo, fecha, hora, creado_por)
    values (${clientId}, ${titulo}, ${fecha}, ${hora}, ${session.userId})
  `;
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/calendario");
}

export async function guardarNotasReunion(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const notas = String(formData.get("notas") ?? "");
  const marcarRealizada = formData.get("marcarRealizada") === "on";
  if (!id) return;

  await sql`
    update meetings set notas = ${notas}, estado = ${marcarRealizada ? "realizada" : "programada"}, actualizado_en = now()
    where id = ${id}
  `;
  revalidatePath(`/reuniones/${id}`);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/calendario");
}
