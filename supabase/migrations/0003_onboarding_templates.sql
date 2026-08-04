-- Checklist de onboarding (§3.8) — usado para poblar el panel "Onboarding"
-- de la ficha de cliente con datos reales en vez del 85% estático del mock.

insert into checklist_templates (id, tipo, servicio_tipo, nombre) values
  ('00000000-0000-0000-0000-000000000010', 'onboarding', null, 'Onboarding común'),
  ('00000000-0000-0000-0000-000000000011', 'onboarding', 'seo_aeo_geo', 'Onboarding SEO · AEO · GEO'),
  ('00000000-0000-0000-0000-000000000012', 'onboarding', 'meta_ads', 'Onboarding Meta Ads'),
  ('00000000-0000-0000-0000-000000000013', 'onboarding', 'google_ads', 'Onboarding Google Ads');

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000010', 1, 'Contrato/propuesta firmada', true),
  ('00000000-0000-0000-0000-000000000010', 2, 'Kickoff agendado', false),
  ('00000000-0000-0000-0000-000000000010', 3, 'Brandbook y logos recibidos', false),
  ('00000000-0000-0000-0000-000000000010', 4, 'ClickUp Doc de bitácora creado', false),
  ('00000000-0000-0000-0000-000000000010', 5, 'Alta en la plataforma', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000011', 1, 'Acceso a GA4', true),
  ('00000000-0000-0000-0000-000000000011', 2, 'Acceso a Search Console', true),
  ('00000000-0000-0000-0000-000000000011', 3, 'Acceso al CMS/hosting (si aplica)', false),
  ('00000000-0000-0000-0000-000000000011', 4, 'Verificación de sitemap', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000012', 1, 'Acceso a Meta Business Manager', true),
  ('00000000-0000-0000-0000-000000000012', 2, 'Píxel instalado y verificado', true),
  ('00000000-0000-0000-0000-000000000012', 3, 'Eventos de conversión configurados', false),
  ('00000000-0000-0000-0000-000000000012', 4, 'Método de pago / facturación aclarado', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000013', 1, 'Acceso a la cuenta de Google Ads', true),
  ('00000000-0000-0000-0000-000000000013', 2, 'Etiqueta/conversiones verificadas', true),
  ('00000000-0000-0000-0000-000000000013', 3, 'Vinculación GA4 ↔ Google Ads', false);
