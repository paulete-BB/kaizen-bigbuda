-- Agente de optimización (Fase 1): sesión de trabajo con un agente de Claude
-- por optimización de Ads. El plan y el resumen viven en la sesión; los
-- mensajes se guardan tal cual los entrega la API (bloques de contenido).
create table if not exists agent_sessions (
  id uuid primary key default gen_random_uuid(),
  optimization_id uuid not null references optimizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'cerrada')),
  plan jsonb not null default '[]'::jsonb,
  resumen_borrador text,
  hallazgos_borrador text,
  procesando_desde timestamptz,
  creado_por uuid references users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists idx_agent_sessions_optimization on agent_sessions(optimization_id);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  orden integer not null,
  rol text not null check (rol in ('user', 'assistant')),
  contenido jsonb not null,
  creado_en timestamptz not null default now(),
  unique (session_id, orden)
);
create index if not exists idx_agent_messages_session on agent_messages(session_id, orden);
