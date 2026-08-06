-- Integración real de bitácora con ClickUp (§3.3) — Fase 2.
--
-- La estructura real del workspace de Bigbuda no es "un Doc por cliente"
-- como asumía el modelo original: existe un único Doc "Bitácoras de
-- Clientes" (compartido) con una página por cliente, mantenida a mano por
-- el equipo (ficha de accesos, objetivos, reuniones). Para no arriesgar
-- pisar ese contenido con las escrituras automáticas de la plataforma, cada
-- cliente recibe su propia página *dedicada* dentro de ese mismo Doc,
-- exclusiva para las entradas que escribe la app — nunca se toca la página
-- de ficha manual.
--
-- clients.clickup_bitacora_page_id cachea el id de esa página dedicada una
-- vez creada (se crea perezosamente en la primera escritura). El id del
-- Doc compartido vive en settings, no por cliente, porque es el mismo para
-- todos — clients.clickup_doc_id (§4.2 original) queda sin usar para este
-- flujo.

alter table clients add column if not exists clickup_bitacora_page_id text;

alter table settings add column if not exists clickup_bitacora_doc_id text;

-- Semilla con los IDs reales del workspace "Bigbuda Inc" (confirmados vía
-- API contra el token de la plataforma) — el admin puede cambiarlos desde
-- /ajustes si el Doc se reemplaza.
update settings set
  clickup_workspace_id = coalesce(clickup_workspace_id, '9014030943'),
  clickup_bitacora_doc_id = coalesce(clickup_bitacora_doc_id, '8cmecjz-23934')
where id = 1;
