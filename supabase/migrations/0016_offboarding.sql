-- Offboarding (§3.12) — checklist de cierre cuando un cliente cancela sus
-- servicios, mismo patrón que el onboarding (§3.8, migración 0003): una
-- plantilla común + una por tipo de servicio, instanciada cuando el cliente
-- pasa a `finalizado` (no perezosa al abrir la ficha como onboarding —acá
-- el disparador es un evento explícito: "Salida de cliente"—, con el mismo
-- fallback idempotente por si el cliente ya estaba finalizado de antes).

insert into checklist_templates (id, tipo, servicio_tipo, nombre) values
  ('00000000-0000-0000-0000-000000000020', 'offboarding', null, 'Cierre del cliente'),
  ('00000000-0000-0000-0000-000000000021', 'offboarding', 'seo_aeo_geo', 'Cierre SEO · AEO · GEO'),
  ('00000000-0000-0000-0000-000000000022', 'offboarding', 'meta_ads', 'Cierre Meta Ads'),
  ('00000000-0000-0000-0000-000000000023', 'offboarding', 'google_ads', 'Cierre Google Ads');

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000020', 1, 'Informe final entregado', true),
  ('00000000-0000-0000-0000-000000000020', 2, 'Cliente notificado formalmente', true),
  ('00000000-0000-0000-0000-000000000020', 3, 'Bitácora archivada', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000021', 1, 'Acceso a GA4 revocado/devuelto', false),
  ('00000000-0000-0000-0000-000000000021', 2, 'Acceso a Search Console revocado/devuelto', false),
  ('00000000-0000-0000-0000-000000000021', 3, 'Acceso al CMS/hosting revocado (si aplica)', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000022', 1, 'Campañas Meta Ads pausadas o transferidas', true),
  ('00000000-0000-0000-0000-000000000022', 2, 'Acceso a Meta Business Manager revocado/devuelto', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000023', 1, 'Campañas Google Ads pausadas o transferidas', true),
  ('00000000-0000-0000-0000-000000000023', 2, 'Acceso a la cuenta de Google Ads revocado/devuelto', false);

-- Retención de datos (§3.12 / Ley 21.719): nota editable de qué se conserva
-- (historial de trabajo, informes — según el brief) y marca de cuándo se
-- eliminaron los datos personales del contacto a solicitud. No se borra la
-- fila del cliente ni su historial operativo, solo los campos de contacto.
alter table clients add column if not exists datos_retenidos_nota text;
alter table clients add column if not exists contacto_anonimizado_en timestamptz;
