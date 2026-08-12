-- OAuth de Google (GSC + GA4) con refresh token — §3.14. Una sola cuenta
-- de conexión para toda la agencia (no por cliente): las propiedades GSC/
-- GA4 de cada cliente ya se seleccionan por separado en clients.*, esto
-- solo guarda el refresh token de la cuenta de Google que tiene acceso a
-- todas ellas. Se guarda en settings, no en env, porque se genera en
-- vivo al conectar (Authorization Code + PKCE) — mismo patrón que los IDs
-- de ClickUp ya guardados ahí.
alter table settings add column if not exists google_refresh_token text;
alter table settings add column if not exists google_connected_email text;
