-- Integración de datos GSC/GA4/Meta (§3.14). Los campos gsc_property,
-- ga4_property_id, meta_ad_account_id, fb_page_id, ig_account_id ya existen
-- desde la migración 0001 (§4.2 original) pero nunca se conectó ninguna UI
-- ni lógica a ellos. meta_token_key es nuevo: el dashboard de referencia
-- (seo-dashboard, portado en esta ronda) soporta que un cliente use un
-- token de System User de Meta distinto al de la agencia (ej. cuando el
-- Business Manager vive del lado del cliente) — sin este campo, ese caso
-- real se perdía al portar la integración.
alter table clients add column if not exists meta_token_key text;
