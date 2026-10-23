# Plan de pendientes (para retomar después de la migración de hosting)

Orden sugerido:

1. **Onboarding estancado (§3.8)** — alerta en el dashboard para ítems en `solicitado` por más de `settings.diasAlertaOnboarding` días. Chico.
2. **Retrospectiva mensual del área (§3.13)** — cron el primer día hábil del mes, tabla `retro_reports` (ya existe, migración 0006), vista histórica mes a mes.
3. **Prompts vinculados a optimizaciones (§3.6)** — modelo listo (`checklist_items_template.prompt_id`); falta primero un editor de plantillas de checklist.
4. **Matching de campañas de Google Ads por ID** — mismo riesgo teórico que el bug de Meta (nombre vs. ID en `utm_campaign`); solo si aparece un caso real.
5. **Administración de usuarios** — hoy altas/bajas por SQL.

Deuda aceptada: Google Ads sigue vía GA4 (sin API propia de Ads).
