// Ítems bloqueantes del checklist de cierre (§3.12) que se confirman en el
// mismo momento de "Salida de cliente" — pedido explícito del usuario tras
// notar que el drawer no preguntaba nada al dar de baja. Mismo texto que las
// plantillas reales (`supabase/migrations/0016_offboarding.sql`); sin
// dependencias de servidor para poder usarse desde un client component sin
// ida y vuelta a la base.

export const ITEMS_BLOQUEANTES_COMUN = ["Informe final entregado", "Cliente notificado formalmente"];

export const ITEM_BLOQUEANTE_POR_SERVICIO: Record<string, string> = {
  meta_ads: "Campañas Meta Ads pausadas o transferidas",
  google_ads: "Campañas Google Ads pausadas o transferidas",
};

/** SEO no tiene ítem bloqueante en el checklist de cierre — solo Meta/Google Ads y el común. */
export function itemsBloqueantesSalida(serviciosTipos: string[]): string[] {
  const items = [...ITEMS_BLOQUEANTES_COMUN];
  const tipos = new Set(serviciosTipos);
  if (tipos.has("meta_ads")) items.push(ITEM_BLOQUEANTE_POR_SERVICIO.meta_ads);
  if (tipos.has("google_ads")) items.push(ITEM_BLOQUEANTE_POR_SERVICIO.google_ads);
  return items;
}
