-- Sincronización bidireccional ClickUp → plataforma (§3.5) — webhook
-- taskStatusUpdated. clickup_webhook_id/secret guardan el resultado de
-- registrar el webhook contra el workspace (POST /team/{id}/webhook, hecho
-- una sola vez desde registrarWebhookClickUp en lib/clickup/client.ts); el
-- secret firma cada entrega (header X-Signature) y se guarda en settings,
-- no en env, porque lo genera ClickUp al registrar, igual que el resto de
-- los IDs de ClickUp ya guardados ahí (folder/doc/list ids).
alter table settings add column if not exists clickup_webhook_id text;
alter table settings add column if not exists clickup_webhook_secret text;

-- Marca cuándo se detectó la tarea como completada en ClickUp (status con
-- type = 'closed', el único bucket realmente terminal — 'done' se usa
-- también para estados no terminales como "rechazado" o "en pausa", así
-- que no basta con ese type). No dispara sola el registro de la
-- optimización (eso requiere resumen/hallazgos escritos por el equipo);
-- solo alimenta la alerta del dashboard para que no se pierda.
alter table optimizations add column if not exists clickup_completada_en timestamptz;
