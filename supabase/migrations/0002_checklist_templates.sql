-- Plantillas estándar de checklist (§3.10) — editables por el admin luego,
-- pero deben existir desde el arranque para que RegistroSEO y BloqueMiercoles
-- puedan instanciarlas.

insert into checklist_templates (id, tipo, servicio_tipo, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'optimizacion', 'seo_aeo_geo', 'SEO · AEO · GEO mensual'),
  ('00000000-0000-0000-0000-000000000002', 'optimizacion', 'meta_ads', 'Ads semanal'),
  ('00000000-0000-0000-0000-000000000003', 'optimizacion', 'google_ads', 'Ads semanal');

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Search Console — cobertura, CTR y posiciones', false),
  ('00000000-0000-0000-0000-000000000001', 2, 'GA4 — tráfico orgánico y tráfico desde IA', false),
  ('00000000-0000-0000-0000-000000000001', 3, 'Técnico — velocidad, indexación, errores', false),
  ('00000000-0000-0000-0000-000000000001', 4, 'Contenido / AEO — FAQs y datos estructurados', false),
  ('00000000-0000-0000-0000-000000000001', 5, 'GEO / local — ficha de Google Business y reseñas', false),
  ('00000000-0000-0000-0000-000000000001', 6, 'Enlazado interno y canibalización', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000002', 1, 'Revisar gasto acumulado y pacing del mes', false),
  ('00000000-0000-0000-0000-000000000002', 2, 'Revisar rendimiento por campaña / conjunto', false),
  ('00000000-0000-0000-0000-000000000002', 3, 'Revisar creativos fatigados', false),
  ('00000000-0000-0000-0000-000000000002', 4, 'Registrar cambios realizados', false);

insert into checklist_items_template (template_id, orden, descripcion, bloqueante) values
  ('00000000-0000-0000-0000-000000000003', 1, 'Revisar gasto acumulado y pacing del mes', false),
  ('00000000-0000-0000-0000-000000000003', 2, 'Revisar rendimiento por campaña / conjunto', false),
  ('00000000-0000-0000-0000-000000000003', 3, 'Revisar creativos fatigados', false),
  ('00000000-0000-0000-0000-000000000003', 4, 'Registrar cambios realizados', false);
