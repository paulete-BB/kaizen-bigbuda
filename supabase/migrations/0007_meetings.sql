-- Reuniones agendadas con el cliente (fuera del ciclo de optimizaciones):
-- se agendan desde la ficha de cliente, aparecen en el calendario, y tras
-- realizarse se les agregan las notas de lo conversado.

do $$ begin
  create type meeting_estado as enum ('programada', 'realizada', 'cancelada');
exception when duplicate_object then null; end $$;

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titulo text not null,
  fecha date not null,
  hora time,
  estado meeting_estado not null default 'programada',
  notas text,
  creado_por uuid references users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_meetings_client on meetings(client_id);
create index if not exists idx_meetings_fecha on meetings(fecha);
