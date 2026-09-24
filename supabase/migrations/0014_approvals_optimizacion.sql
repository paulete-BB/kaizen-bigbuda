-- Flujo de aprobaciones (§3.11): enganchar una aprobación a la optimización
-- que bloquea ("una optimización puede marcarse como bloqueada por
-- aprobación pendiente") y calcular el estado "sin_respuesta" igual que
-- services_view/discounts_view (§4.2) — sin cron, contra el umbral de
-- settings.dias_alerta_aprobacion en el momento de la consulta, en vez de
-- depender de que alguien marque el estado a mano.
alter table approvals add column if not exists optimization_id uuid references optimizations(id) on delete set null;

create index if not exists idx_approvals_optimization on approvals(optimization_id) where optimization_id is not null;

create view approvals_view as
select
  a.*,
  case
    when a.estado = 'enviado' and (current_date - a.enviado_en) >= (select dias_alerta_aprobacion from settings where id = 1)
    then 'sin_respuesta'::approval_estado
    else a.estado
  end as estado_efectivo
from approvals a;
