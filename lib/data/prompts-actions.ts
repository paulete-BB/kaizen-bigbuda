"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { CATEGORIAS_PROMPT, type PromptCategoria } from "@/lib/data/prompts";

export interface AccionPromptResultado {
  ok: boolean;
  error?: string;
  version?: number;
}

function parsearTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function esCategoriaValida(v: string): v is PromptCategoria {
  return (CATEGORIAS_PROMPT as readonly string[]).includes(v);
}

export async function crearPrompt(formData: FormData): Promise<void> {
  const session = await requireUser();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();
  const tags = parsearTags(String(formData.get("tags") ?? ""));
  const notas = String(formData.get("notas") ?? "").trim();
  const herramienta = String(formData.get("herramienta") ?? "").trim();

  if (!titulo || !contenido || !esCategoriaValida(categoria)) return;

  const [creado] = await sql<{ id: string }[]>`
    insert into prompts (titulo, categoria, tags, contenido, notas, herramienta, version, creado_por)
    values (${titulo}, ${categoria}::prompt_categoria, ${tags}, ${contenido}, ${notas || null}, ${herramienta || null}, 1, ${session.userId})
    returning id
  `;
  revalidatePath("/prompts");
  redirect(`/prompts/${creado.id}`);
}

/**
 * Cada edición archiva el contenido vigente en `prompt_versions` antes de
 * sobrescribirlo (§3.6: "cada edición guarda versión anterior") — la fila
 * de `prompts` siempre es la versión actual, nunca un snapshot histórico.
 */
export async function editarPrompt(formData: FormData): Promise<AccionPromptResultado> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();
  const tags = parsearTags(String(formData.get("tags") ?? ""));
  const notas = String(formData.get("notas") ?? "").trim();
  const herramienta = String(formData.get("herramienta") ?? "").trim();

  if (!id || !titulo || !contenido) return { ok: false, error: "Completa título y contenido." };
  if (!esCategoriaValida(categoria)) return { ok: false, error: "Categoría inválida." };

  const [actual] = await sql<{ version: number; contenido: string }[]>`select version, contenido from prompts where id = ${id}`;
  if (!actual) return { ok: false, error: "Prompt no encontrado." };

  await sql`
    insert into prompt_versions (prompt_id, version, contenido, guardado_por)
    values (${id}, ${actual.version}, ${actual.contenido}, ${session.userId})
  `;
  await sql`
    update prompts set
      titulo = ${titulo}, categoria = ${categoria}::prompt_categoria, tags = ${tags},
      contenido = ${contenido}, notas = ${notas || null}, herramienta = ${herramienta || null},
      version = ${actual.version + 1}, actualizado_en = now()
    where id = ${id}
  `;
  revalidatePath(`/prompts/${id}`);
  revalidatePath("/prompts");
  return { ok: true, version: actual.version + 1 };
}

/** Restaura una versión anterior — cuenta como una edición más (archiva la vigente, sube el número de versión), nunca reescribe el historial. */
export async function restaurarVersionPrompt(formData: FormData): Promise<AccionPromptResultado> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version") ?? 0);
  if (!id || !version) return { ok: false, error: "Datos inválidos." };

  const [objetivo] = await sql<{ contenido: string }[]>`select contenido from prompt_versions where prompt_id = ${id} and version = ${version}`;
  if (!objetivo) return { ok: false, error: "Esa versión no existe." };

  const [actual] = await sql<{ version: number; contenido: string }[]>`select version, contenido from prompts where id = ${id}`;
  if (!actual) return { ok: false, error: "Prompt no encontrado." };

  await sql`
    insert into prompt_versions (prompt_id, version, contenido, guardado_por)
    values (${id}, ${actual.version}, ${actual.contenido}, ${session.userId})
  `;
  await sql`update prompts set contenido = ${objetivo.contenido}, version = ${actual.version + 1}, actualizado_en = now() where id = ${id}`;
  revalidatePath(`/prompts/${id}`);
  return { ok: true };
}

/** Borrado real (distinto del versionado): solo admin, mismo criterio que otras acciones destructivas de la plataforma. */
export async function eliminarPrompt(formData: FormData): Promise<AccionPromptResultado> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Prompt inválido." };
  if (session.rol !== "admin") return { ok: false, error: "Solo un administrador puede eliminar un prompt." };

  await sql`delete from prompts where id = ${id}`;
  revalidatePath("/prompts");
  return { ok: true };
}
