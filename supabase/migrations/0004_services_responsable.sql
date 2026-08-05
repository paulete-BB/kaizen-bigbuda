-- El responsable de un servicio se pasaba ad-hoc al motor de scheduling sin
-- persistirse — Clientes.dc.html (columna "Responsable") y el resto de
-- pantallas necesitan poder leerlo desde la tabla.
alter table services add column responsable_id uuid references users(id);

-- `select s.*` en una vista queda fijo a las columnas que existían al
-- crearla — hay que recrearla para que incluya responsable_id. No se puede
-- usar CREATE OR REPLACE porque la columna nueva no queda al final de la
-- lista (queda antes de "estado", la columna calculada de la vista).
drop view services_view;
create view services_view as
select
  s.*,
  case
    when s.pausado then 'pausado'
    when s.fecha_termino is null then 'activo'
    when s.fecha_termino < current_date then 'vencido'
    when s.fecha_termino <= current_date + (select dias_alerta_vencimiento_servicio from settings where id = 1) then 'por_vencer'
    else 'activo'
  end as estado
from services s;
