-- Nueva Regla B (§3.2, pedido explícito del usuario): los clientes de Ads
-- (Meta/Google) dejan de revisarse todos juntos los miércoles 16:00 y pasan
-- a repartirse uno por semana cada uno en cualquier día hábil lunes-viernes
-- (viernes ya no es exclusivo de SEO), sin hora fija. Mismo patrón que
-- services.viernes_ordinal_asignado (Regla A) — 1=lunes … 5=viernes, igual
-- convención que Date.getDay() en lib/scheduling/dates.ts.
alter table services add column if not exists dia_semana_ads_asignado int check (dia_semana_ads_asignado between 1 and 5);

-- Offboarding de Andrés (ya no trabaja en la agencia) — no existe ninguna UI
-- de administración de usuarios en el proyecto todavía, se resuelve por SQL
-- esta ronda, igual que el resto de datos de producción tocados directo.
alter table users add column if not exists activo boolean not null default true;

update users set activo = false where email = 'andres@bigbuda.com';

-- Los clientes de campañas los revisa ahora Paulete — se reasigna lo
-- pendiente/futuro (servicios, para que las optimizaciones nuevas ya nazcan
-- con el responsable correcto, y las optimizaciones no realizadas todavía).
-- El historial ya `realizada`/`cancelada` y la bitácora quedan intactos,
-- con el nombre de Andrés, para no perder trazabilidad.
update services set responsable_id = (select id from users where email = 'paulete@bigbuda.com')
  where responsable_id = (select id from users where email = 'andres@bigbuda.com');

update optimizations set responsable_id = (select id from users where email = 'paulete@bigbuda.com')
  where responsable_id = (select id from users where email = 'andres@bigbuda.com')
    and estado in ('programada', 'bloqueada', 'atrasada');
