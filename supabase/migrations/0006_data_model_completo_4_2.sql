-- Kaizen Bigbuda — completa el modelo de datos de CLAUDE.md §4.2.
--
-- 0001-0005 ya cubren clients/services/discounts/optimizations/checklists/
-- budgets/approvals/holidays/absences/reschedules/settings (lo necesario
-- para Fase 1). Esta migración agrega lo que falta para tener el modelo
-- completo de §4.2, adelantando esquema de Fase 3/4 (informes, snapshots de
-- métricas GSC/GA4/Meta, repositorio de prompts, retrospectiva mensual)
-- para que el proyecto Supabase quede con la base completa desde ahora.
--
-- Idempotente: seguro de correr más de una vez sobre la misma base.

create extension if not exists "pgcrypto";

do $$ begin
  create type metric_fuente as enum ('gsc', 'ga4', 'meta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_estado as enum ('borrador', 'listo', 'enviado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prompt_categoria as enum ('SEO', 'AEO', 'GEO', 'Meta Ads', 'Google Ads', 'Informes', 'Otros');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- §3.14 — Snapshots de métricas GSC/GA4/Meta (caché por cliente/período)
-- ---------------------------------------------------------------------------

create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  fuente metric_fuente not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  datos_json jsonb not null default '{}',
  obtenido_en timestamptz not null default now()
);

create index if not exists idx_metric_snapshots_client_periodo
  on metric_snapshots(client_id, periodo_inicio, periodo_fin);

-- ---------------------------------------------------------------------------
-- §3.4 — Informes (borrador editable + registro de envío)
-- ---------------------------------------------------------------------------

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  tipo service_tipo not null,
  periodo_mes int not null check (periodo_mes between 1 and 12),
  periodo_anio int not null,
  contenido_json jsonb not null default '{}',
  estado report_estado not null default 'borrador',
  enviado_en timestamptz,
  enviado_por uuid references users(id),
  destinatario text,
  pdf_url text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (client_id, tipo, periodo_mes, periodo_anio)
);

create index if not exists idx_reports_client on reports(client_id);
create index if not exists idx_reports_periodo on reports(periodo_anio, periodo_mes);

-- log_entries.report_id (§4.2: "report_id NULL") — la bitácora también
-- registra el envío de un informe, no solo optimizaciones.
alter table log_entries add column if not exists report_id uuid references reports(id) on delete set null;

-- ---------------------------------------------------------------------------
-- §3.6 — Repositorio de prompts (versionado + variables + full-text search)
-- ---------------------------------------------------------------------------

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria prompt_categoria not null,
  tags text[] not null default '{}',
  contenido text not null,
  notas text,
  herramienta text,
  version int not null default 1,
  creado_por uuid references users(id),
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  busqueda tsvector generated always as (
    to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(contenido, '') || ' ' || coalesce(notas, ''))
  ) stored
);

create index if not exists idx_prompts_categoria on prompts(categoria);
create index if not exists idx_prompts_busqueda on prompts using gin(busqueda);

create table if not exists prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts(id) on delete cascade,
  version int not null,
  contenido text not null,
  guardado_en timestamptz not null default now(),
  guardado_por uuid references users(id),
  unique (prompt_id, version)
);

-- checklist_items_template.prompt_id (§4.2: "prompt_id NULL") — pasos del
-- checklist pueden sugerir un prompt del repositorio en contexto.
alter table checklist_items_template add column if not exists prompt_id uuid references prompts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- §3.13 — Retrospectiva mensual del área (reporte interno)
-- ---------------------------------------------------------------------------

create table if not exists retro_reports (
  id uuid primary key default gen_random_uuid(),
  mes int not null check (mes between 1 and 12),
  anio int not null,
  contenido_json jsonb not null default '{}',
  generado_en timestamptz not null default now(),
  unique (mes, anio)
);
