import { sql } from "@/lib/db";
import { CATEGORIAS_PROMPT, type PromptCategoria } from "@/lib/prompts-categorias";

export { CATEGORIAS_PROMPT, type PromptCategoria };

export interface PromptResumen {
  id: string;
  titulo: string;
  categoria: PromptCategoria;
  tags: string[];
  herramienta: string | null;
  version: number;
  actualizadoEn: string;
}

export interface PromptDetalle extends PromptResumen {
  contenido: string;
  notas: string | null;
}

export interface PromptVersion {
  version: number;
  contenido: string;
  guardadoEn: string;
  guardadoPor: string | null;
}

interface PromptRow {
  id: string;
  titulo: string;
  categoria: PromptCategoria;
  tags: string[];
  herramienta: string | null;
  version: number;
  actualizado_en: string;
}

/**
 * Lista con filtro por categoría y búsqueda full-text (español, sobre la
 * columna generada `busqueda` de la migración 0006 — título + contenido +
 * notas). Sin `q`, ordena por más reciente; con `q`, por relevancia
 * (`ts_rank`) para que el término buscado suba arriba.
 */
export async function listarPrompts(filtros: { categoria?: PromptCategoria; q?: string }): Promise<PromptResumen[]> {
  const { categoria, q } = filtros;
  const rows = await sql<PromptRow[]>`
    select id, titulo, categoria, tags, herramienta, version, actualizado_en::date as actualizado_en
    from prompts
    where (${categoria ?? null}::prompt_categoria is null or categoria = ${categoria ?? null}::prompt_categoria)
      and (${q ?? ""}::text = '' or busqueda @@ websearch_to_tsquery('spanish', ${q ?? ""}))
    order by
      case when ${q ?? ""}::text = '' then null else ts_rank(busqueda, websearch_to_tsquery('spanish', ${q ?? ""})) end desc nulls last,
      actualizado_en desc
  `;
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria,
    tags: r.tags,
    herramienta: r.herramienta,
    version: r.version,
    actualizadoEn: r.actualizado_en,
  }));
}

export async function getPrompt(id: string): Promise<PromptDetalle | null> {
  const [row] = await sql<(PromptRow & { contenido: string; notas: string | null })[]>`
    select id, titulo, categoria, tags, herramienta, version, actualizado_en::date as actualizado_en, contenido, notas
    from prompts where id = ${id}
  `;
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    categoria: row.categoria,
    tags: row.tags,
    herramienta: row.herramienta,
    version: row.version,
    actualizadoEn: row.actualizado_en,
    contenido: row.contenido,
    notas: row.notas,
  };
}

/** Historial de versiones anteriores (no incluye la actual, que vive en `prompts`) — más nueva primero. */
export async function getVersionesPrompt(promptId: string): Promise<PromptVersion[]> {
  const rows = await sql<{ version: number; contenido: string; guardado_en: string; guardado_por_nombre: string | null }[]>`
    select pv.version, pv.contenido,
      to_char(pv.guardado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as guardado_en,
      u.nombre as guardado_por_nombre
    from prompt_versions pv
    left join users u on u.id = pv.guardado_por
    where pv.prompt_id = ${promptId}
    order by pv.version desc
  `;
  return rows.map((r) => ({ version: r.version, contenido: r.contenido, guardadoEn: r.guardado_en, guardadoPor: r.guardado_por_nombre }));
}

export interface ClienteParaVariables {
  id: string;
  nombre: string;
  sitioWeb: string | null;
}

/** Clientes activos, para el selector de "copiar con variables resueltas" ({{cliente}}/{{url}}). */
export async function listarClientesParaVariables(): Promise<ClienteParaVariables[]> {
  const rows = await sql<{ id: string; nombre: string; sitio_web: string | null }[]>`
    select id, nombre, sitio_web from clients where estado != 'finalizado' order by nombre
  `;
  return rows.map((r) => ({ id: r.id, nombre: r.nombre, sitioWeb: r.sitio_web }));
}
