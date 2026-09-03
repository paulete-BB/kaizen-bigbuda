/**
 * Categorías fijas del repositorio de prompts (§3.6, enum `prompt_categoria`
 * en la base). Sin dependencias de servidor — a diferencia de
 * `lib/data/prompts.ts` (que importa `lib/db`), esto se puede importar
 * directo desde componentes cliente sin arrastrar `postgres`/`fs` al bundle
 * del navegador.
 */
export const CATEGORIAS_PROMPT = ["SEO", "AEO", "GEO", "Meta Ads", "Google Ads", "Informes", "Otros"] as const;
export type PromptCategoria = (typeof CATEGORIAS_PROMPT)[number];
