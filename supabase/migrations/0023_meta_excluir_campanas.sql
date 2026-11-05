-- Campañas de Meta que no son del trabajo de la agencia pero comparten cuenta publicitaria con el cliente
-- (ej. campañas de familiares). Fragmentos del nombre separados por coma; se excluyen de Resultados, informes y
-- briefing. Aditivo: sin dato, no se excluye nada.
alter table clients add column if not exists meta_excluir_campanas text;
