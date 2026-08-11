# BRIEF DE PROYECTO — Kaizen Bigbuda

**Para:** Claude Code
**Rol esperado:** Ingeniero full-stack senior + arquitecto de procesos
**Fecha:** Julio 2026
**Nombre del producto:** Kaizen Bigbuda — plataforma interna de mejora continua del área de Marketing (usar este nombre en repo, base de datos, UI y documentación)
**Versión:** 1.4 — agrega 3.15: pestaña "Resultados" (dashboard en vivo con overlay de optimizaciones, Fase 3). v1.3 — nombre oficial del producto: Kaizen Bigbuda. v1.2 — agrega integración de datos GSC/GA4/Meta con pre-llenado de informes y pacing automático (3.14); v1.1 incluyó onboarding, pacing, checklists, feriados/ausencias, aprobaciones, offboarding y retrospectiva

---

## Estado actual

**Construido (Fase 1 casi cerrada):**

- Modelo de datos: `supabase/migrations/0001`-`0005` cubren lo necesario
  para Fase 1 (§4.2 aplicado a clients/services/discounts/optimizations/
  checklists/budgets/approvals/holidays/absences/reschedules/settings, con
  vistas `services_view`/`discounts_view`); `0006_data_model_completo_4_2.sql`
  agrega el resto del modelo de §4.2 completo — `metric_snapshots` (§3.14),
  `reports` (§3.4), `prompts`/`prompt_versions` (§3.6, con búsqueda
  full-text en español) y `retro_reports` (§3.13); `0007_meetings.sql`
  agrega la tabla de reuniones (fuera del brief original, ver más abajo).
- Auth propia por email con roles `admin`/`miembro` (bcrypt + cookie de
  sesión firmada) — `lib/auth/`.
- Motor de scheduling puro (`lib/scheduling/`, 17 tests vitest en verde):
  reglas A (viernes SEO, máx. 2/viernes, estable mes a mes), B (bloque Ads
  miércoles 16:00, Meta/Google como ítems separados) y D (reprogramación por
  feriado, detección de conflicto por ausencia).
- 6 pantallas conectadas a datos reales (sin mocks): Dashboard, Calendario
  (drag & drop), Clientes, ficha de Cliente, BloqueMiercoles, RegistroSEO,
  Bitácora. Sidebar y tokens de diseño (`app/globals.css`, tema Kaizen
  Bigbuda: canvas/ink/accent dorado/colores por servicio).
- **Alta de cliente + onboarding gating** (§3.8, adelantado desde Fase 2):
  el formulario de alta (`NuevoClienteDrawer`) crea el cliente y sus
  servicios iniciales sin programar ninguna optimización; el checklist de
  onboarding se instancia solo al abrir la ficha (perezoso). Al marcar
  completo el último ítem bloqueante, `activarPrimeraOptimizacionSiCorresponde`
  (`lib/data/onboarding-actions.ts`) dispara el motor de scheduling real
  (asigna viernes ordinal para SEO o el próximo miércoles para Ads) e
  inserta la primera optimización — verificado con Playwright de punta a
  punta contra Postgres local.
- **Reuniones con cliente** (fuera del alcance del brief original,
  agregado a pedido): tabla `meetings`, se agendan desde la ficha del
  cliente, aparecen como chip en el calendario mensual junto a las
  optimizaciones, y tienen su propia página (`/reuniones/[id]`) para dejar
  notas de lo conversado y marcarlas como realizadas.
- **CRUD completo de clientes/servicios/descuentos (§3.1) — Fase 1
  cerrada.** `editarCliente` (datos de contacto), `agregarServicio`
  (activar un servicio nuevo en un cliente existente — corrige de paso
  que `instanciarOnboarding` solo revisaba una vez por cliente, no por
  plantilla, así que un servicio agregado después nunca recibía su
  checklist), `pausarServicio`/`reactivarServicio` (soft-delete: se
  prefirió sobre borrado duro por la auditoría de §4.3 — un servicio
  pausado sigue visible en la ficha, antes desaparecía sin poder
  reactivarlo), y `eliminarDescuento` (borrado real, distinto de
  "terminar antes de tiempo"). **Control de acceso por rol**: finalizar
  un cliente, terminar un descuento antes de tiempo y eliminar un
  descuento ahora exigen `rol = admin` (antes cualquier `miembro`
  autenticado podía hacerlo) — las acciones devuelven `{ok:false,error}`
  y la UI muestra el motivo en vez de fallar en silencio. Verificado con
  Playwright logueado como admin y como miembro.

**Supabase real + deploy en vivo:** el esquema completo (migraciones
`0001`-`0007`) y el seed de datos de prueba están aplicados contra el
proyecto real (`guibqxslwpcpkvjwzrbi.supabase.co`) vía la Management API
de Supabase (Postgres directo y el pooler transaction están bloqueados
por la política de red saliente de *este entorno de desarrollo*, no de
Supabase ni de producción). La contraseña de la base se reseteó a una
puramente alfanumérica (también vía Management API) porque los caracteres
especiales originales rompían el parseo del connection string en más de
una plataforma. **La app está desplegada y funcionando en Vercel**
(proyecto `kaizen-bigbuda`), con `DATABASE_URL` apuntando al pooler
transaction (`aws-1-us-west-2.pooler.supabase.com:6543`, con
`prepare:false` en `lib/db.ts` porque ese modo de pooler no soporta
prepared statements entre transacciones) y un `AUTH_SECRET` propio de
producción (distinto al de desarrollo local) — login verificado en vivo.
**`main` quedó desincronizado a propósito**: el CRUD completo y el
control de acceso por rol viven en `claude/verify-supabase-connection-k8b430`
pero no se mergearon a `main` (decisión explícita — el deploy en vivo de
Vercel sigue mostrando la versión de antes del CRUD hasta que se pida el
merge).

**Fase 1 funcionalmente cerrada.** Empezada Fase 2:

- **Panel de configuración** (`/ajustes`, nuevo ítem real en el Sidebar
  — antes era un placeholder sin `href`): edita la fila única de
  `settings` — workspace/lista default de ClickUp, días de alerta
  (descuento/servicio por vencer, aprobación sin respuesta, onboarding
  estancado) y umbral de pacing. Solo lectura para `miembro` (guardar
  exige `rol = admin`, mismo patrón que el resto del control de acceso).
  `services_view`/`discounts_view` (§4.2, migración 0001) ya leían estos
  umbrales dinámicamente desde `settings` para calcular "por_vencer"; lo
  que faltaba era la UI para poder cambiarlos sin ir a la base a mano.
  Nota: los umbrales hardcodeados en JS de `ServiciosPanel`/`DescuentosPanel`
  (45 y 20 días) todavía no leen de `settings` — quedan como deuda técnica
  si se quiere que la UI refleje el valor configurado en vivo.
- **Creación de presupuesto (§3.9) desde el bloque de miércoles**: cerrado
  el hueco de `guardarAvanceBloque` — antes solo hacía `update` sobre una
  fila de `budgets` existente, así que un servicio de ads sin presupuesto
  cargado para ese mes nunca podía registrar pacing (el gasto se guardaba
  pero el cálculo se descartaba en silencio). Ahora `BloqueCard` tiene un
  campo "Presupuesto mensual acordado" junto al de gasto, y la action hace
  `insert ... on conflict (service_id, mes, anio) do update` — crea la fila
  si no existe o actualiza la existente (mismo pacing/alerta de siempre,
  umbral ±15 desde `settings`). Verificado con Playwright contra Postgres
  local: un servicio (Provetec Mining · Google Ads, agosto sin fila de
  `budgets`) pasó de "—" a pacing calculado tras guardar, y una segunda
  edición del mismo mes actualizó la fila en vez de duplicarla.
- **Bitácora real en ClickUp (§3.3)** — `lib/clickup/client.ts` reemplaza
  el stub. Se conectó contra el workspace real de Bigbuda ("Bigbuda Inc",
  token de API personal en `CLICKUP_API_TOKEN`) y se descubrió que la
  estructura real no es "un Doc por cliente" como asumía el modelo
  original: existe un único Doc compartido "Bitácoras de Clientes" con
  una página por cliente, mantenida a mano por el equipo (ficha de
  accesos, objetivos, reuniones). Para no arriesgar pisar ese contenido,
  cada cliente recibe una página *dedicada* solo para lo que escribe la
  app (`{cliente} · Bitácora Kaizen`), creada perezosamente en la primera
  escritura y cacheada en el nuevo `clients.clickup_bitacora_page_id`
  (migración `0008_clickup_bitacora.sql`); el Doc compartido se configura
  una vez en `settings.clickup_bitacora_doc_id` (editable desde /ajustes,
  ya no dice "todavía no se conecta"). Las escrituras usan
  `content_edit_mode: "append"` de la API v3 (server-side, sin
  read-modify-write). Se confirmó empíricamente que la API de ClickUp
  devuelve 500 intermitentes incluso en lecturas simples, así que
  `clickupFetch` reintenta con backoff (§4.3) antes de degradar a
  `pendiente_sync`, igual que pedía el stub original. Corregido de paso
  un bug real: `registrarBitacora` en `cliente-actions.ts` pasaba
  `clienteNombre: ""` siempre (nunca el nombre real) — ahora resuelve el
  cliente por `clientId` dentro del cliente de ClickUp. Verificado de
  punta a punta (Postgres local + API real de ClickUp): creación de
  página nueva, reutilización por nombre, caché del id, y append
  correcto — sin tocar nunca la ficha manual del cliente. Falta: tareas
  del calendario y webhooks de ClickUp (§3.5) siguen sin implementar; no
  existe todavía el job de reintento de entradas `pendiente_sync`.
- **Tareas/bloques de calendario en ClickUp (§3.5)** — `syncOptimizationTaskToClickUp`
  en `lib/clickup/client.ts`. Otra vez la estructura real no coincidía con
  el modelo original: no hay una sola lista global "Operaciones" por
  cliente (`clients.clickup_list_id`, §4.2, nunca se pobló) sino una
  carpeta por línea de servicio ("SEO + IA" / "Marketing (Ads)") con una
  lista ya existente y en uso por cliente — un cliente con SEO y Ads tiene
  dos listas distintas. Se resuelve por *servicio* (no por cliente):
  busca la lista del cliente dentro de la carpeta que corresponda al tipo
  de servicio y la cachea en el nuevo `services.clickup_list_id`
  (migración `0009_clickup_tasks.sql`); si no encuentra una lista con el
  nombre exacto del cliente (cliente nuevo sin lista en ClickUp todavía),
  cae a `settings.clickup_default_list_id` sin cachear ese fallback (para
  no perder la oportunidad de enganchar la lista real si se crea después).
  Los IDs de ambas carpetas quedan seedeados en `settings` (confirmados
  vía API, igual que el Doc de bitácoras). Tarea con `name`, `due_date`/
  `start_date` (mediodía Chile para SEO, 16:00 para Ads — conversión de
  tz vía Intl, no offset fijo, para no asumir reglas de DST que puedan
  cambiar), `tags` (`optimizacion`, `seo`|`ads`, nombre del cliente),
  `assignees` (mapeado desde el nuevo `users.clickup_user_id`, poblado en
  la misma migración para los dos usuarios reales cuyo email coincide
  exacto con ClickUp — Andrés queda sin mapear a propósito, su email no
  coincide y no se quiso adivinar) y descripción con link a la ficha del
  cliente (`NEXT_PUBLIC_APP_URL`, opcional). Si la optimización ya tiene
  `clickup_task_id` actualiza esa tarea en vez de crear una duplicada —
  enganchado en la creación de la primera optimización (onboarding), la
  optimización siguiente al guardar el registro SEO, y el drag & drop del
  calendario (`reasignarViernesSeo`, que ahora también actualiza la fecha
  de la tarea). Verificado de punta a punta contra Postgres local + API
  real: creación, reprogramación (actualiza la misma tarea, no duplica) y
  lectura de vuelta de los campos (nombre, fecha, tags, assignee) desde
  ClickUp. Falta: no se actualiza/cierra la tarea al marcar la
  optimización como `realizada` (cada lista tiene nombres de estado
  propios, no un "closed" universal — se dejó para un fast-follow),
  generación semanal real de las optimizaciones de Ads en producción
  (hoy solo existe en `scripts/seed.ts`, no como server action), y
  reprogramación automática por feriado/ausencia (regla D) tampoco existe
  persistida en producción — son gaps preexistentes, no de esta ronda.

- **Webhook `taskStatusUpdated` de ClickUp (§3.5, sincronización
  bidireccional)** — `app/api/clickup/webhook/route.ts` +
  `lib/clickup/webhook.ts`. Verifica la firma real de ClickUp (header
  `X-Signature`, HMAC-SHA256 en hex sobre el body crudo, confirmado contra
  la documentación oficial — no asumido) con el secret que devuelve la API
  al crear el webhook, guardado en `settings.clickup_webhook_secret`
  (migración `0010_clickup_webhook.sql`; `registrarWebhookClickUp` en
  `lib/clickup/client.ts` hace el registro una sola vez a mano, pendiente
  de correr hasta que este código esté desplegado y el endpoint sea
  alcanzable — ClickUp no acepta un endpoint que no responde). Al recibir
  el evento, re-consulta la tarea en ClickUp en vez de confiar en el body
  del webhook, porque el único indicador realmente terminal es
  `status.type === "closed"` (confirmado contra listas reales del
  workspace: "done" se usa también para estados no terminales como
  "rechazado" o "en pausa", no alcanza como señal). No marca la
  optimización como `realizada` sola —eso requiere el registro real con
  resumen/hallazgos, que además dispara bitácora y siguiente
  optimización—; guarda `optimizations.clickup_completada_en` y una nueva
  categoría de alerta en el dashboard ("Completada en ClickUp, falta
  registrar") para que el equipo no se olvide de pasar por el registro.
  **Bug real encontrado y corregido en el camino:** `proxy.ts` (el
  middleware de sesión) interceptaba *todas* las rutas salvo `/login`,
  incluyendo `/api/clickup/webhook` — cualquier entrega real de ClickUp
  (sin cookie de sesión, obviamente) habría rebotado con un 307 a `/login`
  en vez de llegar al handler; nunca se habría notado sin probar con un
  servidor real corriendo y una petición HTTP de verdad en vez de invocar
  la función directamente. Agregado `SKIP_SESSION_AUTH_PATHS` para las
  rutas que se autentican con su propio mecanismo en vez de cookie.
  Verificado de punta a punta contra Postgres local + `next dev` real +
  una tarea real de ClickUp: firma válida/inválida/ausente, tarea
  cerrada/reabierta, tarea no asociada a ninguna optimización, y evento
  distinto de `taskStatusUpdated` — los siete casos con el resultado
  esperado.

- **Job de reintento de `pendiente_sync` (§4.3)** — `lib/clickup/retry.ts`
  + `app/api/cron/reintentar-sync/route.ts`, invocado por el cron de
  Vercel (`vercel.json`). `clickupFetch` ya reintenta con backoff dentro de
  una misma llamada (§4.3); esto cubre lo que sigue fallando después de
  esos reintentos (token vencido, permisos, folder/lista borrada, etc.),
  recorriendo hasta 20 filas de `log_entries` y 20 de `optimizations` con
  `sync_status != 'ok'` y reintentando cada una con las mismas funciones de
  sync que usa el flujo normal — ambas rutas ya eran idempotentes de por sí
  (`syncOptimizationTaskToClickUp` actualiza por `clickup_task_id` si ya
  existe; una entrada que llega a `ok` nunca se vuelve a tocar), así que el
  job no necesitó lógica de lock ni de deduplicación propia. Autenticación
  con `Authorization: Bearer $CRON_SECRET` (convención real de Vercel:
  agrega ese header solo si el env var `CRON_SECRET` existe en el
  proyecto — confirmado contra la documentación oficial). Cron en
  `vercel.json` a una vez al día (`0 12 * * *`, ~08:00 Chile) a propósito:
  el plan Hobby de Vercel solo permite cron una vez al día —si el proyecto
  está en un plan superior, se puede ajustar a algo más frecuente.
  **Mismo bug de `proxy.ts` que el webhook, encontrado de nuevo probando
  con petición HTTP real:** sin agregar `/api/cron` a
  `SKIP_SESSION_AUTH_PATHS`, el cron de Vercel (que tampoco manda cookie de
  sesión) habría rebotado a `/login` igual que hubiera pasado con el
  webhook. **Otro bug real encontrado en el camino:** `creado_en` de
  `log_entries` es `timestamptz`, no `date` —a diferencia de columnas
  `date` como `fecha_programada`, que `lib/db.ts` ya parsea como string—,
  así que llegaba como objeto `Date` de JS y `.slice(0, 10)` explotaba;
  resuelto casteando en la query (`creado_en::date`) en vez de parsear el
  `Date` a mano. Verificado de punta a punta contra Postgres local +
  `next dev` real + ClickUp real: auth ausente/incorrecta/correcta, una
  fila `pendiente_sync` de cada tabla se sincroniza y pasa a `ok` (tarea
  nueva creada en ClickUp, página nueva en el Doc real de bitácoras), las
  filas ya `ok` quedan intactas, y una segunda corrida no reintenta nada
  (confirma que es idempotente). Al descubrir que la página de bitácora de
  prueba se creó en el Doc compartido real "Bitácoras de Clientes" (los
  IDs de workspace/doc vienen seedeados por la migración 0008, incluso en
  una base de datos de prueba recién migrada), se confirmó y usó
  `DELETE /workspaces/{id}/docs/{id}/pages/{id}` (API v3) para borrarla sin
  dejar rastro — no está documentado en la guía pública de Docs, pero
  funciona (204) y la página desaparece del listado.

**Fase 3 iniciada — Generador de informes (§3.4), formato SEO-AEO-GEO:**

- **Plantilla visual real, no reconstruida desde el brief.** El usuario
  subió las plantillas ya diseñadas (`Informe SEO-AEO-GEO.dc.html` /
  `Informe Marketing.dc.html`, formato de deck de Claude Design con
  `<x-dc>`/`<x-import>` + `deck-stage.js`/`support.js`) junto con los dos
  PDF de referencia del brief original. No se usa el runtime de esos
  archivos (es la maquinaria del editor visual, no algo para producción);
  se tomó la plantilla como especificación exacta de tipografía, color,
  espaciado y estructura de cada slide, y se transcribió a HTML propio
  (`lib/informes/slides-seo.ts`), incluyendo los 13 slides reales del
  formato completo (Portada, En una frase, Nuestro enfoque, Punto de
  partida, Lo que dejamos funcionando, 2 slides de Detalle, Resultados en
  números, Tráfico desde IA y Antes/Después —ambas opcionales—, Impacto
  proyectado, Hoja de ruta, Garantías) y los logos reales (`public/informes/`).
- **HTML crudo, no JSX con objetos de estilo** (`lib/informes/render.ts`):
  cada slide tiene decenas de propiedades de estilo inline por elemento;
  convertir cada una a un objeto de estilo React solo agrega superficie
  de error de transcripción sin beneficio, porque el contenido no es HTML
  arbitrario de terceros, es la plantilla fija del sistema. Todo texto que
  entra desde el editor pasa por `esc()` antes de interpolarse (o
  `boldAccent()`, que escapa primero y solo después habilita `**negrita**`
  con acento dorado — mismo tratamiento visual que "En una frase" y "El
  insight del mes" de la plantilla real).
- **Export a PDF: imprimir desde el navegador, no Playwright server-side.**
  Se evaluó explícitamente la alternativa (Playwright/Puppeteer +
  `@sparticuz/chromium(-min)` para correr Chromium headless en una función
  serverless de Vercel) y se descartó: ese paquete está documentado para
  runtimes de AWS Lambda, no para Vercel — funcionaría por la superposición
  real entre ambos, pero no es el caso de uso oficialmente soportado y no
  se puede verificar contra un deploy real desde este entorno. La ruta
  `/informes/[id]/imprimir` (`app/informes/[id]/imprimir/page.tsx`) renderiza
  el deck completo a tamaño real con CSS de impresión (`@page` 1920×1080,
  salto de página por slide) — el equipo exporta con Ctrl/Cmd+P → Guardar
  como PDF, mismo motor de renderizado, cero infraestructura nueva.
- **`contenido_json` (tabla `reports`, ya existente desde la migración
  0006 — no hizo falta ninguna migración nueva) guarda solo lo específico
  del informe** (`lib/informes/tipos.ts`): nombre del cliente, contacto,
  sitio web y período se leen en vivo desde `clients`/`reports` al
  renderizar, nunca se duplican en el JSON, para que un cambio de contacto
  no deje informes viejos con datos obsoletos. La sección "Garantías"
  (SEO) y el bloque de garantías del "Cierre" (Ads) son boilerplate fijo
  del sistema (§3.4: "casi nunca cambia entre informes") y no viven en el
  JSON — están hardcodeados en el componente de slide.
- **Pre-llenado real (no solo maquetado) para el formato de campañas**
  (`lib/data/informes-actions.ts`, aplica al crear un borrador nuevo, no al
  duplicar): "Inversión del mes" se pre-llena desde `budgets` si existe
  fila para ese servicio/período (§3.9 ya la calculaba; acá solo se
  reutiliza en vez de volver a pedir el dato a mano), y "¿Qué mejoramos?"
  se pre-llena con los resúmenes de `optimizations.resumen` del período
  (texto crudo — el equipo condensa, tal como pide el brief). El pre-llenado
  real desde GSC/GA4/Meta (§3.14) sigue pendiente y reemplazará estos
  valores por defecto más adelante, no la forma del dato.
- **Editor por secciones con autoguardado** (`components/informes/InformeEditorSeo.tsx`):
  todo el `contenido_json` vive en un solo estado de React; cada sección es
  un `<details>` con sus propios campos, un editor de listas genérico
  (`ListaEditable`) cubre todos los arrays de objetos (decisiones,
  métricas, pasos, filas de tabla) y uno aparte (`ListaTextosEditable`)
  los arrays de strings simples (bullets) — mezclarlos fue el primer
  intento y no compila limpio: no tiene sentido "spreadear" un string como
  si fuera un objeto. Autoguardado con debounce de 1s llamando al mismo
  server action que usa el guardado manual. La vista previa
  (`InformeDeckPreview`) reusa el mismo `renderSlidesSeo` que consume la
  ruta de impresión, escalado con `transform:scale()` — no hay una segunda
  plantilla que se pueda desincronizar de la real.
- **Bug real encontrado probando con Postgres real (no solo tipos):**
  `sql\`insert ... values (${JSON.stringify(contenido)})\`` sobre una
  columna `jsonb` queda doblemente serializado — `postgres.js` ya
  serializa el valor para columnas `jsonb`, así que pre-stringificarlo a
  mano guarda un *string* que contiene el JSON, no un objeto (`jsonb_typeof`
  devolvía `string`, no `object`; `contenido.detalles` llegaba `undefined`
  al leer de vuelta). Corregido usando `sql.json(contenido)`, la forma
  correcta de la librería para este caso.
- **Otro bug real, esta vez de integración entre páginas:** el primer test
  end-to-end abría la vista de impresión en una pestaña nueva del mismo
  browser (`browser.newPage()`) y fallaba porque cada `newPage()` de
  Playwright crea un contexto aislado sin la cookie de sesión de la
  pestaña anterior — nunca se habría notado navegando manualmente en el
  mismo tab. Corregido reusando la misma página en la prueba (no es un bug
  de la app, era un bug del test, pero documentarlo evita que alguien lo
  repita).
- Verificado de punta a punta con Postgres local + `next dev` real +
  Playwright (Chromium headless) contra un cliente de prueba: crear
  borrador, editar texto con `**negrita**` y verlo reflejado en la vista
  previa en vivo, activar/desactivar las dos slides opcionales (13/13
  slides con ambas activas, 11/13 con ambas desactivadas), abrir la vista
  de impresión con las slides correctas, y registrar el envío (dispara
  bitácora real en ClickUp — la página de prueba se creó en el Doc
  compartido real y se borró igual que en la ronda anterior).
- **Formato Ads reducido (6 slides)** — usuario subió la plantilla real
  también para este formato (`Informe Marketing.dc.html`, idéntica byte a
  byte a la ya usada para definir `InformeMarketingContenido`, así que no
  hizo falta rehacer el modelo de contenido). `lib/informes/slides-marketing.ts`
  transcribe los 6 slides (Portada, 01 · ¿Cómo vamos?·cifras, 01 ·
  Inversión del mes, 02 · ¿Qué mejoramos?, 03 · ¿Qué proyectamos?, Cierre)
  con el mismo patrón que el formato SEO — HTML crudo, mismos tokens de
  diseño. `InformeEditorMarketing.tsx` reusa `ListaEditable`,
  `InformeDeckPreview` y las mismas server actions de guardado/envío sin
  ningún cambio; solo cambió el shape de campos. La barra de pacing de
  "Inversión del mes" (ancho del gasto ejecutado + marcador de "día X ·
  Y% del mes") se calcula parseando el número de los campos de texto
  libre (`parsePct` en `slides-marketing.ts`) — los campos siguen siendo
  texto libre como en el resto del sistema (§3.14 los reemplazará después
  por datos reales), esto solo lee el número para dimensionar la barra.
  Verificado de punta a punta contra Postgres local + `next dev` real +
  ClickUp real, con un cliente Meta Ads de prueba: el pre-llenado real
  desde `budgets` y desde `optimizations.resumen` funcionó en ambas ramas
  (mes en curso y mes cerrado, cubiertas por los dos informes de prueba
  de esta ronda y la anterior), las 6 slides se renderizan correctas en
  la vista de impresión, y el registro de envío disparó la bitácora real
  (página de prueba borrada después, igual que las rondas anteriores).
- **Falta:** la integración GSC/GA4/Meta (§3.14) que reemplazaría el
  pre-llenado manual por datos en vivo.

**Próximo paso:** integración GSC/GA4/Meta (§3.14) — OAuth con refresh
token, importador de configuración desde el dashboard existente,
pre-llenado real de métricas en los informes (reemplazando los valores
manuales/pre-llenados-desde-datos-locales que ya existen), y pacing
automático desde Meta API. Requiere que el usuario cree las credenciales
OAuth en Google Cloud antes de poder avanzar en el lado de Google
(GSC/GA4); el lado de Meta usa el mismo token de System User que ya
existe. Aparte, sigue pendiente correr `registrarWebhookClickUp` contra el
workspace real una vez que este código esté en `main` y desplegado
(requiere el endpoint público y alcanzable). La sección 3.15 (pestaña "Resultados",
agregada en v1.4 de este brief) es Fase 3 — no antes.

---

## 1. Contexto

Bigbuda es una agencia de marketing digital (Santiago · Toronto) con múltiples líneas de servicio. Esta plataforma es **exclusivamente para el equipo de marketing**, que gestiona solo dos de ellas:

- **Marketing pagado:** Meta Ads y Google Ads
- **Posicionamiento:** SEO · AEO · GEO

Otros servicios de la agencia (desarrollo web, etc.) quedan **fuera del alcance** de esta herramienta.

Hoy la planificación de optimizaciones, el registro de trabajo y la confección de informes se hacen de forma manual y dispersa. Se necesita una plataforma central que organice el ciclo operativo completo de cada cliente.

## 2. Objetivo del proyecto

Construir una **web app interna (equipo de agencia)** que funcione como dashboard y planificador de clientes, integrada con **ClickUp** en dos puntos:

1. **Bitácora por cliente:** cada registro de optimización se escribe automáticamente en el ClickUp Doc del cliente (con fallback a bitácora interna si la API falla).
2. **Calendario del equipo:** los bloques de trabajo de optimización se crean como tareas con fecha/hora en ClickUp, asignadas al miembro responsable, visibles en la vista Calendario de ClickUp.

Además, la plataforma **genera borradores editables de informes** (con la estructura y diseño de los informes de referencia adjuntos) y **registra su envío**.

## 3. Alcance funcional

### 3.1 Gestión de clientes

- CRUD de clientes: nombre, empresa, contacto (nombre, email, teléfono), sitio web, industria, logo (opcional).
- **Servicios contratados** por cliente (puede tener 1, 2 o los 3; cada uno se trata como servicio independiente con su propia fecha de inicio, registro y seguimiento):
  - `SEO-AEO-GEO`
  - `Meta Ads`
  - `Google Ads`
- **Vigencia del servicio:** cada servicio registra su **período contratado** (ej: 3, 6, 12 meses o indefinido) con fecha de inicio y **fecha de término** calculada o manual. La plataforma alerta cuando un servicio esté por vencer (configurable, default 20 días antes) para avisar al cliente y gestionar la **renovación**; al renovar se extiende la fecha de término conservando el historial.
- **Descuentos:** por cliente se puede registrar uno o más descuentos con: descripción, % o monto, **fecha de inicio** y **fecha de término (plazo)**. La plataforma debe mostrar alertas cuando un descuento esté por vencer (configurable, default 15 días antes) y marcarlo como vencido automáticamente.
- Estado del cliente: activo / pausado / finalizado.
- Mapeo ClickUp por cliente: `clickup_doc_id` (bitácora), `clickup_list_id` (donde se crean las tareas de bloques de trabajo).

### 3.2 Planificador / Calendario central

Vista de calendario (mensual y semanal) que muestra todos los eventos operativos de todos los clientes, con filtros por cliente, servicio y responsable.

**Reglas de programación automática (motor de scheduling):**

**A) Optimización de posicionamiento (SEO-AEO-GEO):**
- Frecuencia: **1 optimización al mes por cliente**.
- Se ejecutan **solo los viernes**, con un **máximo de 2 optimizaciones por viernes** (2 clientes distintos por viernes).
- Cada optimización incluye el **envío de informe** al cliente ese mismo día (el evento debe tener checklist: optimización realizada ✓ / informe enviado ✓).
- El motor debe **distribuir automáticamente la cartera de clientes activos en los viernes del mes** respetando el límite de 2 por viernes. Si la cartera excede la capacidad mensual (viernes del mes × 2), alertar al administrador para redistribuir manualmente.
- La asignación de cada cliente a "su viernes del mes" debe ser estable mes a mes (mismo viernes ordinal, ej: 2.º viernes), con posibilidad de reasignar manualmente con drag & drop.

**B) Optimización de campañas de marketing (Meta/Google Ads):**
- Frecuencia: **semanal, todos los miércoles desde las 16:00** (hora de Chile, `America/Santiago`).
- El bloque de los miércoles agrupa todos los servicios de marketing activos (**Meta Ads y Google Ads se tratan por separado**: si un cliente tiene ambos, aparecen como dos ítems independientes, cada uno marcable como completado con su propia nota).
- **1 informe mensual por cada servicio de marketing activo** (Meta Ads y Google Ads por separado): la plataforma genera el evento "Confeccionar informe mensual" en la primera semana de cada mes (configurable) y el borrador editable correspondiente (ver 3.4).

**C) Registro de cada optimización:**
- Al completar una optimización se registra: cliente, servicio, fecha/hora realizada, responsable, resumen de lo hecho (texto libre + campos estructurados opcionales: tareas ejecutadas, hallazgos, próximos pasos), y **fecha de la próxima optimización** (propuesta automáticamente por el motor según las reglas A/B, editable).
- Cada registro dispara la **escritura en la bitácora ClickUp** (ver 3.3).

**D) Feriados y ausencias (reprogramación automática):**
- La plataforma mantiene un **calendario de feriados de Chile** (tabla editable, precargada por año). Si una optimización cae en feriado, el motor la **reprograma automáticamente** al día hábil más cercano según la regla: SEO → viernes anterior o siguiente (configurable, default: viernes anterior, respetando el límite de 2 por viernes); marketing → jueves siguiente a las 16:00.
- **Ausencias del equipo:** cada usuario puede registrar períodos de vacaciones/licencia. Si el responsable de una optimización está ausente en la fecha programada, el dashboard lo alerta y permite **reasignar responsable** en un clic (actualizando también el assignee de la tarea en ClickUp).
- Toda reprogramación queda registrada (fecha original → nueva fecha, motivo) y se refleja en la tarea de ClickUp.

### 3.3 Bitácora por cliente (integración ClickUp Docs)

- Cada cliente tiene un ClickUp Doc como bitácora. Al guardar una optimización, la plataforma agrega una entrada al Doc vía **ClickUp API** con formato estándar:

```
## [YYYY-MM-DD] Optimización {SEO-AEO-GEO | Meta Ads | Google Ads}
**Responsable:** {nombre}
**Realizado:** {resumen}
**Hallazgos:** {opcional}
**Próxima optimización:** {fecha}
**Informe:** {enviado el YYYY-MM-DD | pendiente}
```

- Endpoints ClickUp a usar: API v3 de Docs (`POST /docs/{doc_id}/pages` o actualización de página existente según convenga; investigar y elegir el patrón más robusto: **una página por mes** dentro del Doc es la estructura preferida).
- **Fallback obligatorio:** si la API de ClickUp falla (timeout, rate limit, permisos), el registro queda guardado en la **bitácora interna de la plataforma** con estado `pendiente_sync`, y un job de reintento lo sincroniza después. La bitácora interna siempre existe como espejo (fuente de verdad local), navegable por cliente con timeline cronológico.

### 3.4 Generador de informes (borrador editable + registro de envío)

- La plataforma genera un **borrador editable** de informe por cliente. Existen **dos formatos** según el servicio:
  - **Informe SEO-AEO-GEO (formato completo):** sigue la estructura de los informes de referencia (PDFs adjuntos: Filtrocentro y Provetec Mining), detallada más abajo.
  - **Informe de marketing Meta Ads / Google Ads (formato reducido):** mismo sistema visual, pero condensado en ~6 slides que responden tres preguntas, pensado para lectura de 3 minutos:
    1. **Portada** (igual al formato completo, con el servicio correspondiente).
    2. **01 · ¿Cómo vamos?** — números clave del mes pre-llenados desde las APIs (3.14): inversión vs. presupuesto (pacing), resultados/conversiones, CPC/CTR o costo por conversión, con **delta vs. mes anterior**. Un slide de cifras grandes + el slide "Inversión del mes".
    3. **02 · ¿Qué mejoramos?** — 3-5 acciones del mes en lenguaje de negocio, **sin detalle técnico** (una línea por acción). Se pre-llena desde los registros de optimización de los miércoles (resúmenes de la bitácora del período), y el equipo edita/condensa.
    4. **03 · ¿Qué proyectamos?** — qué esperar de estas mejoras en el próximo período, cerrando con un **insight destacado de negocio**: una frase sólida que conecte las acciones con el rendimiento comercial del cliente (ej: "bajar el costo por cotización de $X a $Y significa que el mismo presupuesto genera Z cotizaciones más al mes"). El insight es el corazón del informe.
    5. **Cierre** — versión compacta de garantías + logo.
  - **Asistencia de IA (opcional, Fase 4):** botón "generar borrador de insight" que llama a la Anthropic API desde el backend con los datos del período + los registros de bitácora, y propone el resumen de "¿cómo vamos?" y el insight de negocio. Siempre editable; nunca se envía sin revisión humana. (La agencia ya usa este patrón en su dashboard de resultados, sección Recomendaciones.)
- El equipo edita el borrador, exporta a PDF y marca el envío.
- **Estructura de secciones del formato completo SEO-AEO-GEO (plantilla fija, contenido editable):**
  1. **Portada** — logo bigbuda, "Informe de optimización SEO · AEO · GEO" (o Marketing), mes/año, nombre del cliente en tipografía gigante, bajada de una frase, chips de servicios, "Preparado para {contacto} · {empresa}", pie "bigbuda · Santiago · Toronto", nota de confidencialidad.
  2. **01 · En una frase** — resumen ejecutivo en 2-4 líneas, con palabras clave destacadas en color acento.
  3. **02 · Nuestro enfoque** — "Rigor primero: lo que decidimos no hacer" (lista de 3-4 decisiones con justificación breve; opcionalmente una cita del cliente).
  4. **03 · Punto de partida** — diagnóstico en pares métrica destacada + explicación de una línea (4-6 ítems).
  5. **04 · Lo que dejamos funcionando** — tres columnas: SEO ("Que Google te elija"), AEO·IA ("Que la IA te cite"), GEO ("Que te ubiquen en…"), con bullets. Seguido de slides "El detalle · Qué hicimos y por qué" en formato acción → POR QUÉ.
  6. **05 · Resultados en números** — 3-6 cifras grandes con leyenda (antes/después). Incluye slide "Antes/Después: títulos que ahora venden" con título antiguo tachado y nuevo en negrita.
  7. **06 · Impacto proyectado** — tres horizontes: Semanas 2-4, Meses 1-3, Meses 3-6, cada uno con título y párrafo; nota final sobre el factor decisivo.
  8. **07 · Hoja de ruta** — 5 próximos pasos numerados con descripción de una línea.
  9. **08 · Garantías del trabajo** — "Hecho con red de seguridad": 4 tarjetas (Sin tocar tu diseño · Verificado en vivo · Sin inventar nada · Reversible) y cierre con logo.
- **Diseño visual (tokens del sistema de referencia):**
  - Fondo: negro/carbón (`#0d0d0d` aprox.), con sutiles formas circulares más claras de fondo.
  - Acento: dorado/ámbar (`#e8b06e` aprox.) para números, keywords, etiquetas de sección y subrayados.
  - Texto principal blanco/gris claro; secundario gris medio.
  - Etiquetas de sección en mayúsculas con letter-spacing amplio (`0 1 · E N U N A F R A S E`).
  - Títulos grandes: primera parte en peso light, remate en **bold** ("De dónde **partimos**").
  - Formato apaisado 16:9 (una "página" = un slide).
  - Pie de página: logo bigbuda + nombre cliente a la izquierda, etiqueta de sección a la derecha.
- **Funcionalidad:**
  - Editor por secciones (campos estructurados + rich text donde aplique), autoguardado, duplicar informe del mes anterior como base.
  - **Exportar a PDF** manteniendo el diseño (render HTML/CSS → PDF con Playwright/Puppeteer, apaisado 16:9).
  - **Registro de envío:** fecha de envío, medio (email/WhatsApp/otro), destinatario, estado (borrador / listo / enviado). Al marcar "enviado", se registra en la bitácora ClickUp del cliente.
  - Historial de informes por cliente.

### 3.5 Bloques de trabajo en calendario del equipo (ClickUp)

- Al programar optimizaciones, la plataforma crea/actualiza **tareas en ClickUp** (en la lista configurada por cliente o en una lista "Operaciones" global, configurable) con:
  - `name`: "Optimización {servicio} — {cliente}"
  - `start_date` y `due_date` con hora (viernes para SEO; miércoles 16:00 para marketing)
  - `assignees`: miembro(s) del equipo responsable(s)
  - `tags`: `optimizacion`, `seo` | `ads`, nombre del cliente
  - Descripción con link directo a la ficha del cliente en la plataforma.
- Estas tareas aparecen en la **vista Calendario de ClickUp** del equipo — ese es el requisito, no crear calendario externo.
- Sincronización bidireccional mínima: si la tarea se completa en ClickUp, la plataforma la refleja (vía webhook de ClickUp o polling; preferir **webhooks**: `taskStatusUpdated`).

### 3.6 Repositorio de prompts

- CRUD de prompts de trabajo con: título, categoría (`SEO`, `AEO`, `GEO`, `Meta Ads`, `Google Ads`, `Informes`, `Otros`), sub-etiquetas libres, contenido del prompt (soporte markdown y variables tipo `{{cliente}}`, `{{url}}`, `{{mes}}`), notas de uso, herramienta destino (Claude, ChatGPT, extensión Chrome, etc.).
- **Versionado:** cada edición guarda versión anterior (historial consultable, restaurar versión).
- Búsqueda full-text y filtro por categoría.
- Botón "copiar con variables resueltas": seleccionar cliente y la plataforma reemplaza las variables antes de copiar al portapapeles.
- Vincular prompts a tipos de optimización (ej: la optimización SEO mensual sugiere los prompts de su categoría).

### 3.7 Dashboard de inicio

- **Hoy / Esta semana:** optimizaciones programadas, responsables, estado.
- **Alertas:** descuentos por vencer, **servicios por vencer** (clientes con período contratado próximo a terminar, para avisarles con anticipación y gestionar la renovación), optimizaciones atrasadas, informes pendientes de envío, registros con `pendiente_sync` a ClickUp, onboarding estancado, desviaciones de pacing de presupuesto, aprobaciones de cliente sin respuesta y conflictos por feriados/ausencias.
- **Vista por cliente:** ficha con servicios, fechas de inicio, descuentos, última y próxima optimización, últimos informes, acceso a bitácora.
- KPIs simples de operación: % de cumplimiento del calendario del mes, informes enviados vs. planificados.

### 3.8 Onboarding de clientes nuevos

- Al crear un cliente (o activar un servicio nuevo), la plataforma genera un **checklist de onboarding** desde una plantilla editable por servicio. Ítems de referencia:
  - **Comunes:** contrato/propuesta firmada, kickoff agendado, brandbook y logos recibidos, creación del ClickUp Doc de bitácora, alta en esta plataforma.
  - **SEO-AEO-GEO:** acceso a GA4, acceso a Google Search Console, acceso al CMS/hosting (si aplica), verificación de sitemap.
  - **Meta Ads:** acceso a Meta Business Manager, píxel instalado y verificado, eventos de conversión configurados, método de pago/facturación aclarado.
  - **Google Ads:** acceso a la cuenta de Google Ads, etiqueta/conversiones verificadas, vinculación GA4 ↔ Google Ads.
- Cada ítem tiene estado (pendiente / solicitado / recibido), responsable y fecha. El servicio muestra un **% de onboarding completado**; la primera optimización no se programa hasta que los ítems marcados como *bloqueantes* estén completos (o el admin lo fuerce manualmente con advertencia).
- Alertas de onboarding estancado: ítems en "solicitado" por más de N días (default 5).

### 3.9 Control de presupuesto de pauta (pacing)

- Por cada servicio de ads (Meta / Google) se registra el **presupuesto mensual acordado** con el cliente (monto y moneda, CLP/USD).
- En cada optimización de miércoles, el responsable ingresa el **gasto acumulado del mes** (dato manual en v1; integración con APIs de Meta/Google queda como mejora futura).
- La plataforma calcula el **pacing**: % gastado vs. % del mes transcurrido, y alerta desviaciones sobre un umbral configurable (default ±15%): sobregasto (riesgo de agotar presupuesto antes de fin de mes) o subgasto (presupuesto ocioso).
- Historial de presupuesto y gasto por mes, visible en la ficha del cliente y disponible como dato para el informe mensual.

### 3.10 Checklists estándar por tipo de optimización

- Cada tipo de optimización tiene una **plantilla de checklist** editable por el admin, que define los pasos mínimos a revisar para asegurar consistencia sin importar quién ejecute:
  - **SEO-AEO-GEO mensual (ejemplo inicial):** revisar Search Console (cobertura, CTR, posiciones), revisar GA4 (tráfico orgánico y por IA), técnico (velocidad, indexación, errores), contenido/AEO (FAQs, datos estructurados), GEO/local (ficha, reseñas), registrar hallazgos, preparar y enviar informe.
  - **Ads semanal (ejemplo inicial):** revisar gasto y pacing, rendimiento por campaña/conjunto, pausar/ajustar según resultados, revisar creativos fatigados, registrar cambios realizados.
- Al ejecutar una optimización, el checklist se instancia y cada paso se marca; los pasos pueden tener **prompts vinculados** del repositorio (3.6), sugeridos en contexto.
- El registro de la optimización guarda el checklist completado (trazabilidad de qué se revisó).

### 3.11 Flujo de aprobaciones del cliente

- Registro de **solicitudes de aprobación** enviadas al cliente: tipo (creativo, presupuesto, texto/copy, otro), descripción, adjunto/link opcional, fecha de envío, canal.
- Estados: `enviado` → `aprobado` / `rechazado` / `sin respuesta`. Alerta automática si lleva más de N días sin respuesta (default 3), con opción de registrar el recordatorio enviado.
- Las aprobaciones pendientes aparecen en el dashboard y en la ficha del cliente; una optimización puede marcarse como **bloqueada por aprobación pendiente** (queda visible el motivo del atraso).
- Cada aprobación resuelta se registra en la bitácora del cliente (ClickUp + interna).

### 3.12 Offboarding (cierre de servicio)

- Cuando un servicio vence sin renovación o el cliente finaliza, se activa un **checklist de cierre**: informe final entregado, accesos revocados/devueltos (GA4, GSC, Business Manager, Google Ads), campañas pausadas o transferidas, bitácora archivada, cliente notificado formalmente.
- **Retención de datos:** al cerrar, la plataforma marca qué datos se conservan (historial de trabajo, informes) y permite **eliminar los datos personales del contacto** a solicitud, conforme a la Ley 21.719. El cliente queda en estado `finalizado` con su historial archivado y consultable (solo lectura).
- Si el cliente vuelve, se puede **reactivar** conservando el historial.

### 3.13 Retrospectiva del área (reporte interno mensual)

- La plataforma genera automáticamente, el primer día hábil de cada mes, un **reporte interno** del mes anterior con:
  - % de cumplimiento del calendario (optimizaciones realizadas vs. programadas, por servicio y por responsable).
  - Optimizaciones atrasadas o reprogramadas y sus motivos.
  - Informes enviados vs. planificados y días promedio de atraso.
  - Servicios renovados vs. vencidos sin renovar (retención).
  - Alertas de pacing disparadas en el mes.
  - Aprobaciones de clientes con demora.
- Vista histórica para comparar mes a mes. Es un reporte **interno del equipo** (no se envía a clientes); su objetivo es la mejora continua del proceso.

### 3.14 Integración de datos: GSC, GA4 y Meta (pre-llenado de métricas)

La agencia ya opera un dashboard de resultados (HTML estático en GitHub Pages, sin backend) que consume Google Search Console API v3, GA4 Data API y Meta Graph API v19 en vivo desde el navegador. **Ese dashboard no puede usarse como fuente de datos** (no tiene API propia ni persistencia); el planificador debe conectarse **directamente a las mismas tres APIs** desde su backend y convertirse en la capa de datos.

- **Configuración por cliente:** la ficha de cliente incorpora los mismos identificadores que hoy viven en el localStorage del dashboard (`bb_cl`): propiedad GSC (`sc-domain:` o URL), GA4 Property ID, Meta Ad Account ID, Facebook Page ID, Instagram Account ID. Incluir **importador del JSON exportado por el dashboard actual** para migrar la configuración en un paso.
- **Autenticación:**
  - **Google (GSC + GA4):** OAuth 2.0 **Authorization Code + PKCE con refresh token** a nivel de backend (scopes `webmasters.readonly` + `analytics.readonly`), eliminando la limitación de expiración a 1 hora del implicit flow actual. Cuenta de conexión configurable en settings.
  - **Meta:** token de System User (el mismo `META_TOKEN` que hoy usa el Cloudflare Worker), almacenado como secret del backend. Respetar las limitaciones documentadas mientras la app Meta esté en desarrollo.
- **Pre-llenado de informes (3.4):** al generar un borrador, un job trae las métricas del período y las inserta en las secciones correspondientes, todas **editables** después:
  - **Informe SEO-AEO-GEO:** GSC (clics, impresiones, CTR, posición media, top keywords con delta vs. período anterior) + GA4 (tráfico orgánico; sesiones/usuarios/conversiones desde fuentes IA: chatgpt.com, perplexity.ai, gemini.google.com, claude.ai, copilot.microsoft.com, etc.).
  - **Informe Meta Ads:** gasto, impresiones, clics, CPC, CTR, alcance, CPM, resultados por campaña.
  - **Informe Google Ads:** GA4 con filtro `sessionMedium = cpc/paid` — sesiones pagas, conversiones, costo/conversión (requiere vinculación Ads↔GA4), tabla por campaña.
- **Pacing automático (reemplaza el ingreso manual de 3.9):** el gasto acumulado del mes se obtiene de la API de Meta (y de GA4/Google Ads cuando la vinculación lo permita). El campo manual queda como fallback si la API falla o el cliente no está conectado.
- **Caché y resiliencia:** las métricas se cachean por cliente/período en la base de datos (snapshot con timestamp). Si una API falla al generar el informe, se usa el último snapshot con aviso visible de la fecha del dato. Reintentos con backoff, igual que la cola de ClickUp.
- **Limitaciones conocidas a respetar (heredadas del dashboard):** el tráfico desde IAs subestima porque varias plataformas no envían Referer (cae como "direct"); AI Overviews no es filtrable en GSC API. Documentar estos matices como nota al pie automática en las secciones de métricas de IA del informe.

### 3.15 Dashboard de resultados en vivo (pestaña "Resultados")

Nueva sección de la app que absorbe el dashboard de resultados existente de la agencia (HTML estático en GitHub Pages, cuyo código sirve como referencia funcional de métricas, llamadas y vistas), reconstruido de forma nativa sobre la capa de datos de 3.14:

- **Vista por cliente** con selector, mostrando en vivo: GSC (clics, impresiones, CTR, posición, top keywords), GA4 (tráfico orgánico, conversiones, tráfico desde IAs con la lista de dominios del dashboard original) y Meta (gasto, resultados, CPC, CTR, alcance) según los servicios activos del cliente. Rango de fechas configurable con comparación vs. período anterior.
- **Overlay de optimizaciones sobre los gráficos:** las series temporales marcan con líneas/hitos verticales las fechas de cada optimización registrada en la bitácora del cliente (y el envío de informes), para evaluar visualmente el efecto de cada intervención. Es la funcionalidad diferencial de esta vista: conectar el trabajo realizado con la evolución de las métricas.
- Usa la autenticación de backend con refresh tokens de 3.14 (sin expiración de sesión cada hora, a diferencia del dashboard original) y la configuración de IDs por cliente ya existente en la ficha (sin localStorage).
- Los datos consultados alimentan también los `metric_snapshots`, generando histórico consultable (el dashboard original no persiste datos).
- Implementación: parte de la **Fase 3** (comparte la capa de datos con el pre-llenado de informes). El dashboard antiguo se mantiene operativo hasta que esta pestaña lo reemplace; su retiro se decide tras un período de uso en paralelo.

## 4. Requisitos técnicos

### 4.1 Stack sugerido (ajustable si hay mejor criterio)

- **Frontend:** Next.js 14+ (App Router) + TypeScript + Tailwind. Componentes de calendario: FullCalendar o similar con drag & drop.
- **Backend:** API routes de Next.js o backend Node separado. Jobs programados (cron) para: generación mensual del calendario, reintentos de sync ClickUp, alertas de descuentos.
- **Base de datos:** PostgreSQL (Supabase recomendado por auth + storage + cron integrados).
- **Auth:** login por email para el equipo (roles: `admin`, `miembro`). Sin acceso de clientes en v1.
- **PDF:** render HTML → PDF con Playwright o Puppeteer (formato apaisado 1456×816 aprox., una página por sección).
- **Integración ClickUp:** API v2 (tasks, webhooks) + API v3 (docs). Token de API en variables de entorno; configuración de workspace/space/folder/lists desde un panel de ajustes en la app.
- **Zona horaria:** toda la lógica de scheduling en `America/Santiago`.

### 4.2 Modelo de datos (mínimo)

```
users(id, nombre, email, rol, clickup_user_id)
clients(id, nombre, empresa, contacto_nombre, contacto_email, telefono, sitio_web,
        industria, estado, clickup_doc_id, clickup_list_id,
        gsc_property, ga4_property_id, meta_ad_account_id, fb_page_id, ig_account_id,
        creado_en)
metric_snapshots(id, client_id, service_id NULL, fuente[gsc|ga4|meta], periodo_inicio,
                 periodo_fin, datos_json, obtenido_en)
services(id, client_id, tipo[seo_aeo_geo|meta_ads|google_ads],
         fecha_inicio, periodo_meses NULL, fecha_termino NULL,
         estado[activo|por_vencer|vencido|pausado], viernes_ordinal_asignado NULL)
service_renewals(id, service_id, fecha_renovacion, nueva_fecha_termino, notas)
discounts(id, client_id, descripcion, tipo[%|monto], valor, fecha_inicio,
          fecha_termino, estado[activo|por_vencer|vencido])
optimizations(id, client_id, service_id, tipo, fecha_programada, fecha_realizada,
              responsable_id, resumen, hallazgos, proximos_pasos,
              proxima_fecha, informe_enviado_en, estado, clickup_task_id,
              sync_status[ok|pendiente_sync|error])
reports(id, client_id, service_id, tipo[seo_aeo_geo|meta_ads|google_ads], periodo(mes,año), contenido_json,
        estado[borrador|listo|enviado], enviado_en, enviado_por, destinatario, pdf_url)
log_entries(id, client_id, optimization_id NULL, report_id NULL, contenido,
            creado_en, clickup_page_id, sync_status)
prompts(id, titulo, categoria, tags[], contenido, notas, herramienta, version,
        creado_por, actualizado_en)
prompt_versions(id, prompt_id, version, contenido, guardado_en)
checklist_templates(id, tipo[onboarding|optimizacion|offboarding], servicio_tipo, nombre)
checklist_items_template(id, template_id, orden, descripcion, bloqueante, prompt_id NULL)
checklist_instances(id, template_id, client_id, service_id NULL, optimization_id NULL,
                    estado, creado_en)
checklist_items(id, instance_id, descripcion, estado[pendiente|solicitado|recibido|completado],
                responsable_id, fecha, notas)
budgets(id, service_id, mes, año, presupuesto, moneda[CLP|USD],
        gasto_acumulado, actualizado_en, pacing_pct, alerta_disparada)
approvals(id, client_id, service_id NULL, tipo[creativo|presupuesto|copy|otro],
          descripcion, link, enviado_en, canal, estado[enviado|aprobado|rechazado|sin_respuesta],
          resuelto_en, recordatorios[])
holidays(id, fecha, nombre, año)
absences(id, user_id, fecha_inicio, fecha_fin, motivo)
reschedules(id, optimization_id, fecha_original, fecha_nueva, motivo[feriado|ausencia|manual], creado_en)
retro_reports(id, mes, año, contenido_json, generado_en)
settings(clickup_workspace_id, clickup_default_list_id, dias_alerta_descuento,
         dias_alerta_vencimiento_servicio, umbral_pacing_pct, dias_alerta_aprobacion,
         dias_alerta_onboarding, ...)
```

### 4.3 Requisitos no funcionales

- Idioma de la interfaz: **español (Chile)**.
- Responsive (uso principal desktop; consulta desde móvil).
- Toda operación de escritura en ClickUp debe ser **idempotente y con reintentos** (cola con backoff exponencial).
- Auditoría: quién creó/editó cada registro y cuándo.
- **Protección de datos:** la app almacena datos de contacto de clientes; aplicar control de acceso por roles, cifrado en tránsito y en reposo, y capacidad de eliminar completamente los datos de un cliente (relevante para el cumplimiento de la Ley 21.719 de Chile, vigente desde diciembre 2026).

## 5. Fases de implementación sugeridas

**Fase 1 — Core (MVP):** auth, CRUD clientes/servicios/descuentos, motor de scheduling (reglas A, B y D: feriados y ausencias con reprogramación), calendario central con drag & drop, registro de optimizaciones con checklists estándar (3.10), bitácora interna, dashboard con alertas.

**Fase 2 — Integración ClickUp + operación:** panel de configuración, escritura de bitácora en Docs, creación de tareas/bloques de calendario, webhooks de estado, cola de sincronización con fallback. Además: **onboarding de clientes (3.8)** y **control de presupuesto/pacing (3.9)**.

**Fase 3 — Informes + datos:** editor de borradores por secciones, plantilla visual bigbuda, export a PDF, registro de envío, duplicado mensual, y pestaña "Resultados" con dashboard en vivo y overlay de optimizaciones (3.15). **Integración GSC/GA4/Meta (3.14):** OAuth con refresh token, importador de configuración desde el dashboard existente, pre-llenado de métricas en borradores, pacing automático desde Meta API con fallback manual, caché de snapshots.

**Fase 4 — Prompts y mejora continua:** repositorio de prompts con versionado y variables (vinculados a checklists), **flujo de aprobaciones (3.11)**, **offboarding (3.12)**, **retrospectiva mensual del área (3.13)**, KPIs de operación, refinamiento de UX.

Cada fase debe entregarse funcionando y probada antes de pasar a la siguiente.

## 6. Criterios de aceptación (resumen)

1. Al crear un cliente con SEO-AEO-GEO activo, el sistema le asigna automáticamente un viernes del mes (máx. 2 clientes por viernes) y crea el evento recurrente mensual con checklist de optimización + envío de informe.
2. Todos los miércoles a las 16:00 existe el bloque de optimización de marketing con la lista de servicios activos (Meta Ads y Google Ads como ítems separados por cliente).
3. Al completar y guardar una optimización, en menos de 1 minuto la entrada aparece en el ClickUp Doc del cliente; si ClickUp no responde, queda en bitácora interna con `pendiente_sync` y se sincroniza al reintentar.
4. Cada optimización programada existe como tarea en ClickUp con fecha, hora, responsable y tags, visible en la vista Calendario.
5. Se puede generar el borrador de informe mensual, editar cada sección, exportar un PDF apaisado fiel al diseño de referencia y registrar el envío (lo que agrega la entrada a la bitácora).
6. Los descuentos y los servicios con período contratado generan alerta N días antes de vencer y cambian de estado automáticamente; al renovar un servicio se extiende su vigencia conservando el historial.
7. El repositorio de prompts permite crear, versionar, buscar y copiar prompts con variables resueltas por cliente.
8. Si una fecha programada cae en feriado o el responsable está ausente, el sistema reprograma/alerta según la regla D y la tarea de ClickUp se actualiza en consecuencia.
9. Al activar un servicio nuevo se genera su checklist de onboarding; la primera optimización no se programa con ítems bloqueantes pendientes (salvo override del admin).
10. Con presupuesto y gasto acumulado registrados, el sistema calcula el pacing y dispara alerta al superar el umbral de desviación configurado.
11. Una aprobación de cliente sin respuesta por más de N días genera alerta, y su resolución queda registrada en la bitácora.
12. El primer día hábil de cada mes existe el reporte de retrospectiva del mes anterior con cumplimiento, atrasos, retención y alertas del período.
13. Al generar un borrador de informe de un cliente con GSC/GA4/Meta configurados, las secciones de métricas llegan pre-llenadas con los datos del período (editables); si una API falla, se usa el último snapshot cacheado con aviso de fecha. El pacing de ads se actualiza automáticamente desde la API con fallback a ingreso manual.

## 7. Material de referencia

- `Filtrocentro - Presentación SEO-AEO-GEO - Bigbuda.pdf` — informe de referencia (estructura + diseño).
- `Provetec Mining - Informe SEO-AEO-GEO - Bigbuda.pdf` — segundo ejemplo del mismo sistema de diseño.
- Ambos definen la plantilla de la sección 3.4: replicar estructura, jerarquía tipográfica y paleta.

## 8. Preguntas abiertas (resolver con el equipo antes o durante Fase 2)

- ¿Las tareas de ClickUp se crean en una lista global "Operaciones" o en la lista de cada cliente? (default propuesto: global, configurable).
- ¿Quiénes son los responsables por defecto de cada línea de servicio? (definir en settings).
- ¿El informe de marketing mensual usa la misma plantilla visual que el de SEO con secciones adaptadas? (propuesto: sí, misma plantilla con métricas de campañas).
