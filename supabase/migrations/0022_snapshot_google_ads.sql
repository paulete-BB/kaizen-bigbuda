-- Fuente nueva para los snapshots de métricas (§3.14): la API de Google Ads. Se guarda aparte de 'ga4' porque
-- tiene otra forma de datos (costo real en la moneda de la cuenta, conversiones de Ads) y compartir la clave
-- (cliente, servicio, fuente, período) con el proxy de GA4 haría que, ante una falla de la API, el último
-- snapshot devuelto fuera de la forma equivocada.
alter type metric_fuente add value if not exists 'google_ads';
