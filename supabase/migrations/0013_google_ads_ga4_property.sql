-- Google Ads (§3.14/§3.15) no comparte la propiedad GA4 del sitio del
-- cliente: las campañas de Google Ads apuntan a una landing page propia,
-- con su propia propiedad GA4 para medir el tráfico pagado — pedido
-- explícito del usuario tras ver que el número de Google Ads no calzaba.
-- Meta Ads no tiene este problema porque se conecta por token (Meta
-- Insights API), no vía GA4. `ga4_property_id` sigue siendo la propiedad
-- del sitio principal, usada por SEO/AEO; este campo nuevo es solo para
-- la sección Google Ads de Resultados y el pre-llenado del informe de
-- Google Ads.
alter table clients add column if not exists google_ads_ga4_property_id text;
