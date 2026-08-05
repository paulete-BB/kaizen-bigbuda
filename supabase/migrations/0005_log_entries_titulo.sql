-- La bitácora necesita título/tipo estructurados para la UI (no conviene
-- parsear el markdown de `contenido`, que es el espejo que se sincroniza a
-- ClickUp Doc según §3.3).
alter table log_entries add column titulo text not null default '';
alter table log_entries add column tipo text not null default '';
