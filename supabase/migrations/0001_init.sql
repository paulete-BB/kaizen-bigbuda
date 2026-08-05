-- Kaizen Bigbuda — esquema inicial (Fase 1), basado en CLAUDE.md §4.2.
-- Pensado para correr tal cual contra un proyecto Supabase real (Postgres) o
-- contra un Postgres local de desarrollo — ver .env.example / DATABASE_URL.

create extension if not exists "pgcrypto";

create type user_rol as enum ('admin', 'miembro');
create type service_tipo as enum ('seo_aeo_geo', 'meta_ads', 'google_ads');
create type client_estado as enum ('activo', 'pausado', 'finalizado');
create type discount_tipo as enum ('pct', 'monto');
create type moneda as enum ('CLP', 'USD');
create type tarea_destino as enum ('checklist', 'recurrente');
create type optimizacion_estado as enum ('programada', 'realizada', 'atrasada', 'bloqueada', 'cancelada');
create type sync_status as enum ('ok', 'pendiente_sync', 'error');
create type reschedule_motivo as enum ('feriado', 'ausencia', 'manual');
create type checklist_tipo as enum ('onboarding', 'optimizacion', 'offboarding');
create type checklist_item_estado as enum ('pendiente', 'solicitado', 'recibido', 'completado');
create type checklist_instance_estado as enum ('pendiente', 'en_progreso', 'completo');
create type approval_tipo as enum ('creativo', 'presupuesto', 'copy', 'otro');
create type approval_estado as enum ('enviado', 'aprobado', 'rechazado', 'sin_respuesta');

-- ---------------------------------------------------------------------------
-- Equipo
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  rol user_rol not null default 'miembro',
  iniciales text not null,
  color text not null default '#a86f1c',
  clickup_user_id text,
  -- Auth propia mientras no hay un proyecto Supabase real con GoTrue
  -- (ver .env.example). Se retira cuando se conecte Supabase Auth.
  password_hash text not null,
  creado_en timestamptz not null default now()
);

create table absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  motivo text,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clientes y servicios
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text not null,
  contacto_nombre text not null,
  contacto_email text not null,
  contacto_telefono text,
  sitio_web text,
  industria text,
  logo_url text,
  estado client_estado not null default 'activo',
  clickup_doc_id text,
  clickup_list_id text,
  gsc_property text,
  ga4_property_id text,
  meta_ad_account_id text,
  fb_page_id text,
  ig_account_id text,
  creado_en timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  tipo service_tipo not null,
  fecha_inicio date not null,
  periodo_meses int,
  fecha_termino date,
  pausado boolean not null default false,
  viernes_ordinal_asignado int check (viernes_ordinal_asignado between 1 and 5),
  presupuesto_mensual numeric(14, 2),
  moneda moneda,
  creado_en timestamptz not null default now(),
  unique (client_id, tipo)
);

create table service_renewals (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  fecha_renovacion date not null default current_date,
  nueva_fecha_termino date not null,
  notas text,
  creado_por uuid references users(id),
  creado_en timestamptz not null default now()
);

create table discounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  descripcion text not null,
  tipo discount_tipo not null default 'pct',
  valor numeric(10, 2) not null,
  fecha_inicio date not null default current_date,
  fecha_termino date not null,
  creado_en timestamptz not null default now()
);

-- Tareas del panel "Tareas a revisar" de la ficha de cliente — no está en
-- §4.2 literal, pero Cliente.dc.html (ya aprobado) la necesita.
create table client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titulo text not null,
  destino tarea_destino not null default 'checklist',
  frecuencia text,
  servicio_tipo service_tipo not null,
  responsable_id uuid references users(id),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Feriados y presupuestos
-- ---------------------------------------------------------------------------

create table holidays (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  nombre text not null,
  anio int not null
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  anio int not null,
  presupuesto numeric(14, 2) not null,
  moneda moneda not null default 'CLP',
  gasto_acumulado numeric(14, 2) not null default 0,
  pacing_pct numeric(6, 2),
  alerta_disparada boolean not null default false,
  actualizado_en timestamptz not null default now(),
  unique (service_id, mes, anio)
);

-- ---------------------------------------------------------------------------
-- Checklists (plantillas + instancias)
-- ---------------------------------------------------------------------------

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tipo checklist_tipo not null,
  servicio_tipo service_tipo,
  nombre text not null
);

create table checklist_items_template (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id) on delete cascade,
  orden int not null,
  descripcion text not null,
  bloqueante boolean not null default false
);

create table checklist_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  optimization_id uuid,
  estado checklist_instance_estado not null default 'pendiente',
  creado_en timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references checklist_instances(id) on delete cascade,
  orden int not null,
  descripcion text not null,
  estado checklist_item_estado not null default 'pendiente',
  responsable_id uuid references users(id),
  fecha date,
  notas text
);

-- ---------------------------------------------------------------------------
-- Optimizaciones (motor de scheduling) y bitácora
-- ---------------------------------------------------------------------------

create table optimizations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  tipo service_tipo not null,
  fecha_programada date not null,
  hora_programada time,
  fecha_realizada date,
  responsable_id uuid references users(id),
  resumen text,
  hallazgos text,
  proximos_pasos text,
  proxima_fecha date,
  informe_enviado_en date,
  estado optimizacion_estado not null default 'programada',
  bloqueada_motivo text,
  clickup_task_id text,
  sync_status sync_status not null default 'pendiente_sync',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table checklist_instances
  add constraint checklist_instances_optimization_fk
  foreign key (optimization_id) references optimizations(id) on delete cascade;

create table reschedules (
  id uuid primary key default gen_random_uuid(),
  optimization_id uuid not null references optimizations(id) on delete cascade,
  fecha_original date not null,
  fecha_nueva date not null,
  motivo reschedule_motivo not null,
  notas text,
  creado_por uuid references users(id),
  creado_en timestamptz not null default now()
);

create table log_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  optimization_id uuid references optimizations(id) on delete set null,
  contenido text not null,
  clickup_page_id text,
  sync_status sync_status not null default 'pendiente_sync',
  creado_por uuid references users(id),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aprobaciones y settings
-- ---------------------------------------------------------------------------

create table approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  tipo approval_tipo not null,
  descripcion text not null,
  link text,
  enviado_en date not null default current_date,
  canal text,
  estado approval_estado not null default 'enviado',
  resuelto_en date,
  creado_en timestamptz not null default now()
);

create table approval_reminders (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references approvals(id) on delete cascade,
  enviado_en date not null default current_date
);

create table settings (
  id int primary key default 1 check (id = 1),
  clickup_workspace_id text,
  clickup_default_list_id text,
  dias_alerta_descuento int not null default 15,
  dias_alerta_vencimiento_servicio int not null default 20,
  umbral_pacing_pct int not null default 15,
  dias_alerta_aprobacion int not null default 3,
  dias_alerta_onboarding int not null default 5
);
insert into settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index idx_services_client on services(client_id);
create index idx_optimizations_client on optimizations(client_id);
create index idx_optimizations_fecha on optimizations(fecha_programada);
create index idx_optimizations_tipo_fecha on optimizations(tipo, fecha_programada);
create index idx_discounts_client on discounts(client_id);
create index idx_log_entries_client on log_entries(client_id, creado_en desc);
create index idx_client_tasks_client on client_tasks(client_id);
create index idx_budgets_service_periodo on budgets(service_id, anio, mes);
create index idx_approvals_client on approvals(client_id);

-- ---------------------------------------------------------------------------
-- Vistas: estado calculado (sin cron) para vigencias/descuentos
-- ---------------------------------------------------------------------------

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

create view discounts_view as
select
  d.*,
  case
    when d.fecha_termino < current_date then 'vencido'
    when d.fecha_termino <= current_date + (select dias_alerta_descuento from settings where id = 1) then 'por_vencer'
    else 'activo'
  end as estado
from discounts d;
