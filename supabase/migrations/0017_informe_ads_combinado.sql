-- Kaizen Bigbuda — informe combinado de Ads (§3.4) para clientes con
-- Meta Ads y Google Ads activos a la vez: pedido explícito del usuario,
-- "deberia haber un solo informe con las 2 campañas para poder comparar
-- los resultados e ir viendo cual rinde mejor en resultados de negocio".
--
-- `reports.tipo` reusaba `service_tipo` (el mismo enum de `services.tipo`,
-- `optimizations.tipo`, `checklist_templates.servicio_tipo`) — un informe
-- combinado no es un tipo de servicio real que un cliente pueda contratar
-- (nunca existe una fila de `services` con ese valor), así que agregarlo a
-- `service_tipo` habría forzado a todo el resto de esas tablas a lidiar con
-- un valor que nunca les aplica. `reports.tipo` pasa a un enum propio,
-- `report_tipo`, que repite los tres valores reales de servicio y suma
-- `ads_combinado`.
--
-- Idempotente: seguro de correr más de una vez sobre la misma base.

do $$ begin
  create type report_tipo as enum ('seo_aeo_geo', 'meta_ads', 'google_ads', 'ads_combinado');
exception when duplicate_object then null; end $$;

do $$
begin
  if not exists (
    select 1 from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_type t on t.oid = a.atttypid
    where c.relname = 'reports' and a.attname = 'tipo' and t.typname = 'report_tipo'
  ) then
    alter table reports alter column tipo type report_tipo using tipo::text::report_tipo;
  end if;
end $$;
