-- Tareas/bloques de calendario en ClickUp (§3.5) — Fase 2.
--
-- La estructura real del workspace tampoco es "una lista global Operaciones"
-- como sugería el brief como opción por defecto: cada línea de servicio
-- tiene su propia carpeta ("SEO + IA" / "Marketing (Ads)") con una lista
-- por cliente ya existente y en uso por el equipo. clients.clickup_list_id
-- (§4.2 original, migración 0001) asumía una sola lista por cliente —no
-- alcanza, porque un cliente con SEO y Ads tiene DOS listas distintas—, así
-- que la lista se resuelve y cachea por *servicio*, no por cliente.

alter table services add column if not exists clickup_list_id text;

alter table settings add column if not exists clickup_folder_seo_id text;
alter table settings add column if not exists clickup_folder_ads_id text;

-- Semilla con los IDs reales de las carpetas del workspace "Bigbuda Inc"
-- (confirmados vía API) — clickup_default_list_id (ya existente) sigue de
-- fallback para un cliente sin lista propia todavía en esas carpetas.
update settings set
  clickup_folder_seo_id = coalesce(clickup_folder_seo_id, '90147534801'),
  clickup_folder_ads_id = coalesce(clickup_folder_ads_id, '90147446377')
where id = 1;

-- clickup_user_id real de los dos usuarios cuyo email de la plataforma
-- coincide exacto con su email en ClickUp (confirmado vía API). Andrés
-- queda sin mapear a propósito: su email en la plataforma
-- (andres@bigbuda.com) no coincide con el de ClickUp
-- (andres.hoffmann@bigbuda.com) y no se quiso adivinar el match.
update users set clickup_user_id = coalesce(clickup_user_id, '66758296') where email = 'marcel@bigbuda.com';
update users set clickup_user_id = coalesce(clickup_user_id, '94217349') where email = 'paulete@bigbuda.com';
