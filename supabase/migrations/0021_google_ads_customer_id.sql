-- API de Google Ads (plan en docs/plan-google-ads-api.md): ID de la cuenta de Google Ads de cada
-- cliente (10 dígitos, sin guiones). Aditivo: sin este dato, todo sigue funcionando con el proxy de
-- GA4 (sessionSource = google / sessionMedium = cpc).
alter table clients add column if not exists google_ads_customer_id text;
