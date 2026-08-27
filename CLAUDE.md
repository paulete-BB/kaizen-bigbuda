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
**`main` mergeado con `claude/verify-supabase-connection-k8b430` (a
pedido explícito del usuario, para poder probar en vivo el flujo de
conexión de Google que requiere un login real)** — hasta ese momento
`main` había quedado desincronizado a propósito mientras se
desarrollaba el CRUD, el control de acceso por rol, ClickUp Fase 2 y el
generador de informes; ahora el deploy en vivo de Vercel refleja todo
eso. De acá en adelante, seguir desarrollando sobre esta misma rama y
mergeando a `main` cuando se pida, como hasta ahora — no se volvió a un
esquema de ramas separadas por defecto.

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

**Integración GSC/GA4/Meta (§3.14) — arrancada, porteando el dashboard
real existente:**

- El usuario tiene un dashboard de resultados ya en producción
  (`seo-dashboard` en GitHub, HTML estático + un Cloudflare Worker como
  proxy CORS de Meta/Anthropic) que consume estas tres APIs en vivo desde
  el navegador — exactamente el que describe el brief como "no puede
  usarse como fuente de datos". Se leyó completo (no se reconstruyó la
  lógica de memoria): OAuth implícito de Google (client ID hardcodeado,
  token en `sessionStorage`, sin refresh — el problema exacto que este
  §3.14 tiene que resolver), los query shapes reales de GSC
  (`searchAnalytics/query`) y GA4 (`runReport`, con los filtros exactos de
  `sessionDefaultChannelGroup`/`sessionMedium`/`sessionSource` que ya
  resuelven "organic vs. paid vs. IA"), los campos de Meta Insights
  pedidos, y la lista real de dominios de IA usada para clasificar
  tráfico. Se va a portar esa lógica ya probada en producción al backend,
  no reinventarla.
- **Config por cliente (§4.2, columnas que ya existían desde la
  migración 0001 pero nunca tenían UI ni lógica conectada)**:
  `IntegracionesPanel.tsx` en la ficha del cliente edita
  `gsc_property`/`ga4_property_id`/`meta_ad_account_id`/`fb_page_id`/
  `ig_account_id` — los mismos campos que el dashboard viejo guardaba en
  `localStorage['bb_cl']`. Se agregó `meta_token_key` (migración
  `0011_meta_token_key.sql`), no contemplado en el brief original: el
  dashboard real soporta que un cliente use su propio token de System
  User de Meta en vez del de la agencia (cuando el Business Manager vive
  del lado del cliente) — se preservó esa capacidad real al portar en vez
  de perderla por apegarse estrictamente al modelo de datos del brief.
- **Importador del JSON exportado** (§3.14: "incluir importador... para
  migrar la configuración en un paso") — sección en `/ajustes`
  (`ImportadorConfigDashboard.tsx` + `lib/data/integraciones-actions.ts`,
  solo admin). Empareja por **nombre** de cliente, no por la URL de GSC
  que usaba el dashboard original para deduplicar en su propio import
  (ese emparejamiento se rompía con clientes sin SEO contratado, que
  comparten `url: ""`). Nunca crea clientes nuevos desde el import, solo
  completa los campos de integración de los que ya existen — de lo
  contrario un typo en el nombre exportado podría dar de alta un cliente
  duplicado sin querer. Verificado de punta a punta contra Postgres
  local + `next dev` real: guardar configuración a mano en la ficha,
  importar un JSON que pisa esos valores y agrega uno nuevo, y un nombre
  sin cliente correspondiente queda reportado como "sin emparejar" en vez
  de fallar en silencio.
- **OAuth de Google (Authorization Code + PKCE) construido y verificado
  de punta a punta, incluido un login real** — `lib/google/oauth.ts` +
  `app/api/auth/google/iniciar` + `.../callback` (migración
  `0012_google_oauth.sql`: `settings.google_refresh_token`/
  `google_connected_email`). Antes del login real ya se había probado
  contra la API real de Google todo lo que no requería completarlo:
  `/iniciar` arma la URL de autorización con PKCE y Google la acepta sin
  `redirect_uri_mismatch` ni `invalid_client`; el callback maneja los tres
  casos de error reales (`access_denied`, state inválido, código de
  autorización inválido contra el endpoint real de intercambio de
  tokens). El usuario completó el consentimiento con su cuenta real
  (`paulete@bigbuda.com`) contra el deploy de producción — confirmado
  directo en la base real: `settings.google_connected_email` y
  `google_refresh_token` quedaron guardados correctamente.
  **Depuración real hasta llegar ahí** (documentado porque costó varias
  vueltas, no por el código en sí): (1) la integración de Vercel con
  GitHub se había roto en algún momento ("Project Link not found" en
  Settings → Git) — ningún push a `main` disparaba deploy nuevo, así que
  el fix de abajo nunca llegaba a producción hasta reconectarla y forzar
  un commit vacío para generar un webhook nuevo; (2) `/api/auth/google/iniciar`
  no atrapaba errores de configuración (`GOOGLE_OAUTH_CLIENT_ID`/
  `NEXT_PUBLIC_APP_URL` ausentes) y tiraba un 500 genérico en vez de decir
  qué faltaba — corregido para redirigir a `/ajustes` con el mensaje de
  error concreto, igual que ya hacía el callback; (3) la credencial de
  Google que el usuario había creado y pasado originalmente resultó ser
  de un proyecto de Google Cloud distinto al que pensaba — una vez
  creada la credencial correcta en el proyecto correcto, conectó a la
  primera.
- **Clientes de fetch server-side** — `lib/google/gsc.ts` (resumen,
  keywords, serie diaria, listado de propiedades), `lib/google/ga4.ts`
  (tráfico orgánico, tráfico desde IA con la lista de dominios del
  dashboard real —menos `google.com`/`bard.google.com`, que el dashboard
  original agrupaba como "Google AI Overview" pero en la práctica
  matchea casi todo el tráfico orgánico normal; mejor subestimar tráfico
  de IA que inflarlo—, tráfico pagado vía `sessionMedium`), y
  `lib/meta/client.ts` (resumen de cuenta y por campaña, mismos campos y
  mismo criterio de "resultados" que el dashboard real —prioriza
  landing/click/compra del píxel antes de sumar todas las acciones a
  ciegas—, ya sin necesitar el Cloudflare Worker porque corre
  server-side). `lib/metricas/snapshot.ts` es el wrapper de caché y
  resiliencia (§3.14): intenta la llamada en vivo e inserta una fila
  nueva en `metric_snapshots` (histórico, no upsert — es la fuente de
  datos de la pestaña "Resultados", §3.15); si falla, cae al último
  snapshot para ese mismo cliente/servicio/fuente/período con aviso.
- **Tokens de Meta recibidos: dos, ambos por cliente, sin token general
  de agencia** — el Worker real nunca tuvo un `META_TOKEN` default, solo
  overrides por cliente (`meta_token_key`, ya soportado desde la ronda
  anterior). Configurado `meta_token_key = 'TECNY_STAND'` en producción
  para ese cliente (el otro token es de "Piso Urbano", que todavía no es
  un cliente dado de alta en la plataforma — el token queda pendiente de
  asignar cuando se le dé de alta). Ninguno de los dos clientes tiene
  todavía `meta_ad_account_id`/`gsc_property`/`ga4_property_id`
  configurados en producción, así que `lib/meta/client.ts`/`gsc.ts`/
  `ga4.ts` están escritos siguiendo exactamente los shapes ya probados
  del dashboard real pero **sin verificar contra una llamada real
  todavía** — falta que el usuario complete esos IDs para poder probarlo
  de punta a punta.

**Webhook `taskStatusUpdated` registrado contra el workspace real** —
corrido `registrarWebhookClickUp` (vía llamada directa a la API de
ClickUp + Management API de Supabase para guardar el resultado, porque
esta sandbox sigue sin acceso directo a Postgres; mismo efecto que
correr la función). Antes de registrar se confirmó que el endpoint de
producción respondía (`GET` → 405 esperado; `POST` sin secret aún
configurado → 500 esperado, no un deploy roto). ClickUp devolvió
`health.status: "active"` al registrarlo — confirma que pudo alcanzar el
endpoint. Guardado `clickup_webhook_id`/`clickup_webhook_secret` en
`settings` de producción. Verificado el cambio de estado real: la misma
entrega sin firma que antes daba 500 (sin secret configurado) ahora da
401 (secret configurado, firma inválida rechazada) — confirma que el
webhook está realmente activo, no solo registrado en la base.

**`lib/google/gsc.ts`/`ga4.ts`/`lib/meta/client.ts` verificados contra
datos reales.** Guardado `meta_ad_account_id` real de Tecny Stand en
producción; probado `obtenerResumenMeta`/`obtenerCampanasMeta` contra su
cuenta real (gasto, impresiones, clics, 2 campañas reales con nombre).
Para GSC/GA4 el usuario dio los IDs de un cliente que todavía no existe
en la plataforma (Gonfernic, `sc-domain:gonfernic.cl` / GA4
`368771119`) — no hacía falta crear la ficha para probar las funciones,
así que se probaron directo contra esos IDs sin tocar la base de
clientes: `obtenerResumenGSC`/`obtenerKeywordsGSC` devolvieron datos
reales y sensatos (keywords de su rubro real, café en comodato) y
`obtenerTraficoOrganicoGA4`/`obtenerTraficoIAGA4` también (incluida
tracción real desde ChatGPT y Gemini, aunque baja — consistente con la
limitación documentada en §3.14 de que este tráfico se subestima).
Probado corriendo las funciones reales contra Postgres local con el
refresh token real de producción copiado temporalmente a la base de
prueba (nunca impreso en la sesión, borrado el archivo intermedio al
terminar) — no contra un mock.

**Gonfernic dado de alta como cliente real** (Fernando Abarca ·
abarca@gonfernic.cl · industria "Máquinas de Café y Snack en comodato" ·
servicios SEO-AEO-GEO y Google Ads), con `gsc_property`/`ga4_property_id`
ya cargados desde el alta — mismos INSERTs que haría el formulario real,
corridos vía Management API por el mismo motivo que las migraciones
(esta sandbox no tiene acceso directo a Postgres). El checklist de
onboarding se instancia solo al abrir la ficha por primera vez (perezoso,
como ya documentado), así que no hizo falta crearlo a mano.

**Pre-llenado real de informes desde GSC/GA4/Meta (§3.14 → §3.4),
reemplaza el pre-llenado manual/local de la ronda anterior:**
`lib/informes/prellenado-apis.ts` (`prellenarSeoDesdeApis`,
`prellenarAdsDesdeApis`) queda enganchado en `crearInforme`
(`lib/data/informes-actions.ts`) — solo al crear un borrador nuevo, no al
duplicar (duplicar sigue copiando el contenido tal cual del informe
origen, sin volver a pedir datos a las APIs). Para SEO-AEO-GEO trae
"Punto de partida" desde GSC (CTR, posición media, impresiones, clics) y
"Tráfico desde IA" desde GA4; para Meta Ads trae las cifras de
"¿Cómo vamos?" desde Meta Insights (con delta vs. mes anterior); para
Google Ads, desde GA4 filtrado por `sessionMedium=cpc/paid` (§3.14: no
hay API de Google Ads propia conectada). Ambas rutas usan
`conCacheDeSnapshot` (snapshot nuevo en éxito, último snapshot cacheado
si la API falla) y degradan en silencio a lo que ya hacía el pre-llenado
anterior si el cliente no tiene la propiedad/cuenta configurada — nunca
rompen la creación del informe.
**Pacing automático (§3.9 → automático):** `prellenarInversionDelMes`
ahora recibe el gasto real de Meta/GA4 (`ads.gastoReal`) cuando la
moneda coincide con la de `budgets`, y lo usa en vez del
`gasto_acumulado` manual para el cálculo de pacing — el presupuesto
acordado sigue viniendo de `budgets` (ninguna API sabe cuánto se pactó).
Bug evitado en el camino: el campo `estado` ("dentro_rango" /
"sobregasto" / "subgasto") se calculaba antes contra `alerta_disparada`,
un booleano guardado la última vez que el equipo cargó el gasto a mano
en el bloque de miércoles — con el gasto real de la API reemplazando al
manual, ese booleano queda desactualizado. Ahora, cuando hay gasto real
de API, `estado` se recalcula en el momento contra
`settings.umbralPacingPct` en vez de confiar en el valor guardado.
Verificado de punta a punta contra Postgres local + `next dev` real:
Filtrocentro con `gsc_property`/`ga4_property_id` reales de Gonfernic
(el cliente real de prueba de la ronda anterior) trajo CTR/posición/
impresiones/clics de GSC y tráfico real desde ChatGPT/Gemini de GA4;
Tecny Stand con `meta_ad_account_id` real pero sin
`META_TOKEN_TECNY_STAND` en el entorno de prueba local degradó
correctamente al pre-llenado manual desde `budgets` sin romper la
creación del informe (confirma la resiliencia del `try/catch` cuando la
API falla o no está configurada). Las cuatro páginas involucradas
(editor y vista de impresión de ambos informes) cargaron sin errores de
consola. Confirmado `jsonb_typeof` = `object` en ambos (sin regresión
del bug de doble serialización). Datos de prueba (config de API en los
clientes, presupuesto, refresh token de Google copiado temporalmente)
limpiados de la base de prueba al terminar.

**Pestaña "Resultados" (§3.15) — dashboard en vivo con overlay de
optimizaciones, comparte la capa de datos de §3.14:**

- **Nuevo ítem real del Sidebar** (`/resultados`, entre Clientes y
  Ajustes — antes solo existían los placeholders sin `href` de
  "Informes"/"Prompts", que siguen igual). Selector de cliente + rango
  (14/28/90 días, mismos presets que el dashboard de referencia) vía
  `<select>`/`Link` con query params, mismo patrón de navegación que
  `CalendarioPage` — sin `useSearchParams` del lado cliente.
- **Cuatro secciones independientes** (`lib/data/resultados.ts`,
  `obtenerResultadosCliente`): SEO·AEO·GEO (GSC: clics/impresiones/CTR/
  posición media + top keywords + serie diaria de clics), AEO·GEO
  tráfico desde IA (GA4, breakdown por fuente + nota al pie de las
  limitaciones conocidas de §4.3), Meta Ads (gasto/resultados/CTR/CPC/
  alcance + campañas + serie diaria de gasto) y Google Ads (GA4 filtrado
  `sessionMedium=cpc/paid`, sin API de Ads propia — mismo criterio que el
  pre-llenado de informes). Cada sección se gatilla por **servicio activo
  contratado** (no solo por config): sin el servicio, el mensaje dice "no
  tiene X contratado"; con servicio pero sin `gsc_property`/
  `ga4_property_id`/`meta_ad_account_id`, dice qué falta configurar en la
  ficha; y si la API falla se degrada a `conCacheDeSnapshot` con aviso de
  fecha — nunca rompe la página. Reutiliza exactamente los mismos
  fetchers de `lib/google/gsc.ts`/`ga4.ts`/`lib/meta/client.ts` que el
  pre-llenado de informes (Fase 3 anterior), agregando series diarias
  nuevas donde no existían: `obtenerTraficoPagadoDiarioGA4` (GA4) y
  `obtenerSerieDiariaMeta` (Meta, `time_increment:'1'`, mismo query shape
  confirmado contra el dashboard de referencia real).
- **Overlay de optimizaciones — la funcionalidad diferencial del brief**:
  cada gráfico de serie temporal marca con línea vertical punteada +
  punto las fechas de `optimizations.fecha_realizada` (estado
  `realizada`) y `reports.enviado_en` (estado `enviado`) para el
  servicio correspondiente, con tooltip al pasar el mouse. Filtrado por
  *servicio* (no por cliente completo): el gráfico de SEO solo muestra
  hitos de optimizaciones SEO, el de Meta Ads solo los de Meta Ads, etc.
  — la lectura correcta es "esta intervención específica, este efecto en
  esta métrica específica", no todas las intervenciones mezcladas.
- **Gráficos de líneas con crosshair + tooltip propios, sin librería
  nueva** (`components/resultados/SerieTiempo.tsx`): SVG a mano, mismo
  patrón que `Donut.tsx` (dashboard) — el proyecto no tiene Chart.js ni
  ninguna librería de gráficos, y el dashboard de referencia (que sí usa
  Chart.js) es la especificación de qué datos mostrar, no de cómo
  renderizarlos. Construido siguiendo la skill de dataviz del entorno:
  un solo eje (nunca dual-axis — clics/impresiones del dashboard viejo se
  separaron en gráficos distintos en vez de superponerse con dos
  escalas), paleta categórica validada para las fuentes de IA (5 colores
  fijos por dominio, nunca reciclados), hover con crosshair que ubica el
  punto más cercano y un tooltip con fecha + valor + hito si corresponde.
- **KPIs con delta correctamente separado en número vs. color** — bug
  real encontrado y corregido en el camino: para métricas donde bajar es
  mejorar (CPC, costo, posición media), la primera versión invertía el
  signo del número mostrado para que siempre fuera positivo en verde
  ("posición mejoró 4.9%" → "+4.9%"), pero eso contradice la flecha
  (↑ +4.9% junto a un número que en realidad bajó) y el propio contrato
  de la skill de dataviz ("delta: signed, vs a named period; color =
  direction × whether up is good"). Corregido separando `tendencia`
  (flecha, según el signo literal del cambio real) de `favorable` (color,
  según si esa dirección es buena noticia para esa métrica en particular)
  — ahora "costo bajó 12%" se lee flecha abajo + verde, nunca flecha
  arriba con un número negativo.
- **Bug real de bundling encontrado probando con `next dev` real, no solo
  tipos:** `SelectorResultados.tsx` (client component) importaba
  `RANGOS_RESULTADOS` desde `lib/data/resultados.ts`, que a su vez
  importa `lib/db` (el cliente de `postgres`, que usa `fs`/`net` de
  Node) — Next.js intentó incluir todo ese árbol en el bundle del
  navegador y tiró `Module not found: Can't resolve 'fs'`. No se habría
  detectado con `tsc` (los tipos son correctos, es un problema de qué
  código *runtime* cruza el límite server/client). Corregido extrayendo
  las constantes sin dependencias de servidor a `lib/resultados-rango.ts`
  y `lib/resultados-formato.ts` — el resto de los imports desde
  componentes cliente ya eran `import type`, que sí se descarta en
  compilación. Mismo motivo por el que `SerieTiempo` recibe el formato
  como string (`"numero" | "moneda"`) en vez de una función: una función
  tampoco puede cruzar ese límite ("Functions cannot be passed directly
  to Client Components").
- Verificado de punta a punta contra Postgres local + `next dev` real:
  Filtrocentro con `gsc_property`/`ga4_property_id` reales de Gonfernic
  mostró clics/impresiones/CTR/posición con deltas correctos, serie
  diaria de clics con dos hitos de prueba superpuestos (optimización +
  informe enviado, con tooltip al hacer hover confirmado con captura de
  pantalla), top keywords reales, y tráfico real desde ChatGPT en la
  sección AEO; Tecny Stand con `ga4_property_id` de prueba mostró
  sesiones/conversiones/costo reales de Google Ads (vía GA4 pagado) con
  su propio hito de optimización superpuesto, mientras que Meta Ads
  degradó correctamente al mensaje "no se pudo obtener datos" al no
  haber `META_TOKEN_TECNY_STAND` en el entorno de prueba (confirma la
  resiliencia sin romper el resto de la página), y las secciones
  SEO/AEO se ocultaron con "no tiene contratado" al no tener ese
  servicio activo. Cero errores de consola en las cuatro combinaciones
  de cliente/sección. Datos de prueba (config de API, hitos de
  optimización/informe, refresh token de Google) limpiados de la base
  de prueba al terminar.
- **Falta:** el dashboard antiguo (GitHub Pages) se mantiene operativo en
  paralelo hasta decidir su retiro, como indica el brief; esta pestaña no
  persiste todavía un histórico visible más allá de lo que ya guarda
  `metric_snapshots` (§3.14) en cada carga.

**Bug real reportado en producción — "la página se cae" al elegir un
cliente completamente configurado (Gonfernic: SEO-AEO-GEO + Google Ads,
ambos con GSC/GA4 reales):** el selector de cliente en sí funcionaba bien
(confirmado con Playwright contra dev y contra un build de producción
real, clientes sin integraciones cambiaban sin problema) — el problema
aparecía solo con un cliente que dispara las cuatro secciones a la vez.
Causa real encontrada por inspección de `obtenerResultadosCliente`: un
cliente con SEO+Ads configurado dispara ~9 refresh de access token de
Google en paralelo (cada llamada a GSC/GA4 pedía uno propio —
`obtenerAccessTokenGoogle` nunca cacheaba, a propósito, por "volumen
bajo" — supuesto que la propia pestaña Resultados rompe) más ~6 queries
extra a Postgres solo para los hitos de overlay (`obtenerHitos` se
llamaba una vez por sección, no una vez por cliente). Contra Postgres
local, con las credenciales reales de Google y el mismo shape exacto de
Gonfernic (confirmado replicando su configuración real sobre otro
cliente de prueba con los mismos dos servicios), la página respondió
igual de rápido con o sin el fix — la latencia/límites de conexión reales
de producción (pooler de Supabase + red hacia Google) no se pueden
reproducir desde este entorno de desarrollo. Aun así, la causa
estructural (fan-out innecesario de llamadas externas concurrentes que
crece con cuántas integraciones tiene el cliente) es real y se corrigió
igual: `obtenerAccessTokenGoogle` (`lib/google/oauth.ts`) ahora cachea el
access token en memoria del proceso (con margen de 60s antes de expirar)
y deduplica llamadas concurrentes con una promesa compartida —
9 refresh de Google quedan en 1; `obtenerTodosLosHitos`
(`lib/data/resultados.ts`) reemplaza el `obtenerHitos` por sección: 2
queries para las tres líneas de servicio en vez de 2 por sección (hasta
6). Verificado que no hay regresión (mismo render exacto, captura de
pantalla comparada) contra Postgres local + build de producción real
(`next build && next start`, no `next dev`) con el shape de Gonfernic
replicado. Si el problema persiste tras este deploy, el próximo paso es
revisar los logs de la función serverless en Vercel para confirmar la
causa exacta (timeout vs. límite de conexiones del pooler vs. otra cosa)
en vez de seguir infiriéndola desde acá.

**Rediseño de Resultados orientado a impacto de negocio** — feedback real
del usuario tras ver la pestaña en vivo: comparado con el dashboard de
referencia (que se usa en vivo en reuniones con clientes), la primera
versión mostraba KPIs sueltos sin conectar la métrica con "¿esto le sirve
al cliente?". Se agregó, reusando exactamente los mismos fetchers de GSC/
GA4/Meta ya construidos (nada de datos nuevos, solo más lectura de lo que
ya se traía):

- **Frase de insight por sección** (`insightTrafico`/`insightAds`/
  `insightAeo` en `lib/data/resultados.ts`) — regla simple, no IA (eso
  sigue siendo Fase 4, §3.4): compara la dirección de dos deltas (tráfico
  vs. conversión, costo vs. resultados, tasa IA vs. orgánica) y arma una
  lectura de una línea, igual que haría alguien mirando el dashboard con
  el cliente delante. `InsightCallout.tsx` la muestra con el mismo
  tratamiento visual "✦ INSIGHT" del dashboard de referencia.
- **Conversiones orgánicas + funnel SEO** (`Funnel.tsx`): impresiones →
  clics → conversión, con el % de paso entre cada etapa. Trae
  `obtenerTraficoOrganicoGA4` (ya existía en `lib/google/ga4.ts`, sin uso
  hasta ahora) para el cliente cuando tiene GA4 configurado.
- **Tabla de campañas con conversiones/CPA/tasa de conversión**
  (`TablaCampanas.tsx`), reemplaza la barra de solo-gasto anterior tanto
  en Meta Ads como en Google Ads — este último ahora trae desglose real
  por campaña vía `obtenerCampanasPagadoGA4` (nuevo, dimensión
  `sessionCampaignName` de GA4), algo que antes no existía para Google
  Ads. `obtenerCampanasMeta` ahora también devuelve `resultados`
  (conversiones) por campaña, no solo gasto/CTR/CPC.
- **AEO con tasa de conversión y páginas de aterrizaje**: compara la tasa
  de conversión del tráfico IA contra la orgánica (mismo criterio que el
  insight del dashboard de referencia, "convierte Nx mejor") y agrega
  `obtenerPaginasDestinoIAGA4` (nuevo) para responder "¿a qué página está
  llegando la gente que la IA recomienda?".
- **Bug real evitado a tiempo, antes de que llegara a producción:**
  cachear las conversiones orgánicas bajo la misma `fuente:'ga4'` que ya
  usa el tráfico IA (sección AEO) para el mismo cliente/servicio/período
  habría generado una colisión real en `conCacheDeSnapshot` — si la API
  fallara, el fallback "el snapshot más reciente" podría devolver la
  forma equivocada (tráfico IA en vez de conversiones orgánicas, o
  viceversa), rompiendo el render con valores `undefined`. Se resolvió
  pidiendo las conversiones orgánicas **una sola vez** en el orquestador
  (`obtenerResultadosCliente`, como promesa compartida sin cachear en
  `metric_snapshots`) y pasándolas a SEO y AEO — evita la colisión y de
  paso ahorra una llamada duplicada a GA4. Mismo criterio aplicado al
  desglose de campañas de Google Ads (tampoco se cachea, mismo motivo).
- **Segundo bug real, encontrado probando con datos reales de Gonfernic
  (no con datos sintéticos):** la primera versión de la KPI "Tasa de
  conversión" reusaba el delta del *conteo* de conversiones en vez de
  calcular el delta de la *tasa* — con Provetec Mining (replicando el
  shape real de Gonfernic) esto mostraba "Tasa de conversión: 8,8% ↓
  -97,4%" cuando la tasa en realidad había subido +131,7% (las sesiones
  habían caído más que las conversiones). Corregido calculando la tasa de
  ambos períodos y comparando esas dos tasas entre sí, no los conteos
  crudos.
- **Tercer bug real, mismo dato real:** con un período anterior cercano a
  cero, el % de cambio explota a números sin sentido para mostrar en una
  reunión con el cliente (ej. "el costo por conversión subió 3655,9%").
  `fmtDeltaPct` (`lib/resultados-formato.ts`) acota la magnitud mostrada a
  999% — mismo criterio que usan paneles de ads reales — sin tocar el
  signo ni la lógica de favorable/desfavorable, que siguen calculándose
  sobre el número real sin acotar.
- Verificado de punta a punta contra Postgres local + `next dev` real +
  datos reales de Gonfernic (replicados sobre Provetec Mining, mismo
  shape SEO+Google Ads) y Tecny Stand (Meta sin token local, degradación
  correcta): insight de las cuatro secciones, funnel con números reales,
  tabla de keywords con posición/CTR, tabla de páginas de aterrizaje IA,
  tabla de campañas de Google Ads con nombres reales de campaña. Cero
  errores de consola. Datos de prueba limpiados de la base al terminar.
**Distribución de posiciones de keywords + Δ vs. período anterior** —
lo que había quedado pendiente de la ronda anterior:

- `obtenerKeywordsGSC` ya soportaba `rowLimit` configurable; `seccionSeo`
  ahora pide hasta 250 keywords (no solo las 10 de la tabla) tanto del
  período actual como del anterior, en dos llamadas GSC en paralelo —
  necesario porque una distribución representativa (Top3/Top10/Top20/
  Top50/50+) no puede salir de las 10 keywords con más clics, que sesgan
  hacia posiciones altas.
- `DistribucionPosiciones.tsx` reusa el `Donut.tsx` del dashboard (mismo
  patrón que el resto de Resultados: sin librería de charts nueva) con
  paleta fija por bucket (verde/azul/rojo/ámbar/gris), más una leyenda con
  el conteo real de cada uno.
- El Δ de posición por keyword compara la tabla top-10 (ordenada por
  clics, no por posición) contra un mapa `query → posición` construido
  desde las 250 keywords del período anterior — ▲ verde si mejoró
  (posición más baja), ▼ rojo si empeoró, "nuevo" si el término no
  aparecía antes.
- Verificado con datos reales de Gonfernic en dos rangos: 28 días mostró
  deltas reales coherentes (ej. "gonfernic ▲6.2", "mokador ▼0.5") y una
  distribución de 174 keywords; 90 días mostró "nuevo" en todas las filas
  porque los dos períodos (cada uno de 90 días, hace más de medio año de
  diferencia para un dominio joven) no comparten prácticamente ningún
  término — comportamiento esperado, no un bug, confirmado antes de darlo
  por bueno probando también con 28 días. Cero errores de consola. Datos
  de prueba limpiados de la base al terminar.

**Bug real reportado por el usuario — los números de Resultados no
coinciden con Search Console/GA4/Google Ads directos**, con capturas de
los cuatro paneles reales como evidencia. Dos causas distintas, una
corregible y otra estructural:

- **GSC (corregible, corregido):** comparando las capturas, la propia UI
  de Search Console terminaba su ventana de "últimos 28 días" ~2 días
  antes de hoy, no en hoy — confirmado que es el retraso de procesamiento
  de 2-3 días que Google documenta para la API de Search Console. El
  código pedía el rango terminando literalmente hoy; esos últimos días
  vuelven parciales o vacíos sin ningún error, subcontando clics/
  impresiones sin aviso. `desplazarParaGsc` (`lib/data/resultados.ts`)
  desplaza el rango 3 días atrás **solo para las llamadas a GSC** (no
  para GA4/Meta, que no tienen este mismo retraso) — resumen, serie
  diaria y keywords. El gráfico de clics por día ahora rellena hasta la
  fecha desplazada, no hasta la nominal (rellenar con ceros los días
  todavía no procesados los haría ver como una caída real a cero). Nueva
  nota al pie visible en la sección SEO con la fecha real hasta la que
  llegan los datos, mismo criterio que la nota de limitaciones de tráfico
  IA ya existente. Verificado contra datos reales de Gonfernic: antes del
  fix, 81 clics/3.425 impresiones/CTR 2,4% vs. los 85/3,62 mil/2,3% que
  mostraba Search Console directo para la misma ventana nominal; después
  del fix, 88/3.549/2,5% — mucho más cerca (la diferencia restante es
  variación normal día a día, no un desfase sistemático).
- **Google Ads vía GA4 (estructural, no corregible sin la integración
  real de Ads):** la sección Google Ads nunca tuvo una conexión directa a
  la API de Google Ads (§3.14 lo documenta como decisión deliberada,
  "requiere vinculación Ads↔GA4") — usa GA4 filtrado por
  `sessionMedium=cpc/paid` como proxy. La captura del usuario mostró una
  diferencia grande (122,5 conversiones en Google Ads nativo vs. 1 en GA4
  para un rango de fechas parecido pero no idéntico): Google Ads tiene su
  propio seguimiento de conversiones con modelado estadístico y
  atribución entre dispositivos que GA4 no replica — son dos sistemas de
  medición distintos, no un bug de esta app. Se agregó una nota al pie
  visible en la sección explicando esto y recomendando revisar Google Ads
  directo para el número oficial — mismo tratamiento que la nota de
  limitaciones de IA. Resolver esto de verdad requeriría conectar la API
  real de Google Ads, fuera del alcance de este fix.

**Gráfico "Clics y conversiones por día"** — pedido explícito del
usuario tras ver el gráfico de solo-clics: `SerieTiempo.tsx` ahora acepta
una segunda serie opcional (`serieSecundaria`), punteada y sin relleno,
en el mismo eje que la principal — nunca dual-axis, siguiendo la skill de
dataviz del entorno ("two measures of different scale → same axis o
small multiples, nunca dos escalas"). Leyenda con línea de muestra (no
cuadro de color, "line keys not boxes") cuando hay segunda serie, y el
tooltip al hacer hover muestra ambos valores. Nueva
`obtenerTraficoOrganicoDiarioGA4` (`lib/google/ga4.ts`) trae la serie
diaria de conversiones orgánicas en el mismo rango ya desplazado que la
serie de clics de GSC (`desdeGsc`/`hastaGsc`), para que ambas series
compartan el mismo eje de fechas. Color de la serie de conversiones:
`--color-success` (verde), reutilizando el token semántico existente en
vez de inventar uno nuevo. Verificado con datos reales de Gonfernic:
leyenda, ambas líneas con datos reales, tooltip con los dos valores al
hacer hover — capturado con Playwright.

**Tendencia semanal por modelo de IA** — pedido explícito del usuario
tras comparar dos capturas: la barra horizontal "Sesiones por fuente IA"
no se parecía al panel original, que muestra un gráfico de línea semanal
con un marcador circular por semana, una línea por modelo (ChatGPT,
Claude, etc.), eje X en formato de semana ISO ("S31 '26"). Se reemplazó
`BarrasCategoria.tsx` (eliminado, sin otros usos) por
`TendenciaFuentesIA.tsx`, un componente nuevo — no una extensión de
`SerieTiempo` — porque el número de series ahí es variable (una por
fuente detectada en el período) mientras que `SerieTiempo` está acotado a
dos series fijas (principal/secundaria).

- `lib/dates.ts` agrega `isoSemana`/`fmtSemana` (semana ISO 8601, lunes a
  domingo, semana 1 = la que contiene el primer jueves del año — mismo
  criterio que usa el panel de referencia para su eje X).
- `lib/resultados-colores-ia.ts` (nuevo) extrae la paleta categórica fija
  por dominio de IA que antes vivía privada dentro de `BarrasCategoria`,
  para que el nuevo componente de línea use los mismos colores.
- `obtenerTraficoIADiarioGA4` (`lib/google/ga4.ts`) trae sesiones por día
  y por fuente (antes solo existía el total del período,
  `obtenerTraficoIAGA4`). `armarTendenciaSemanal` (`lib/data/resultados.ts`)
  agrupa esas filas diarias en semanas ISO por fuente, con una grilla de
  semanas común (rellenada con 0) para que todas las líneas alineen en el
  mismo eje X aunque una fuente no haya tenido sesiones en alguna semana.
  Sin `conCacheDeSnapshot`: mismo motivo que las conversiones orgánicas de
  SEO y el desglose de campañas de Google Ads — esta forma (por día y por
  fuente) es distinta al resumen actual/anterior que ya se cachea bajo
  `(cliente, servicio, fuente:'ga4', período)`, cachearla ahí generaría la
  misma colisión ya documentada en rondas anteriores.
- `SeccionAeo.porFuente` (el total por fuente, ya sin ningún consumidor
  tras el reemplazo) se eliminó del modelo en vez de dejarlo sin uso;
  `SeccionAeo.tendenciaSemanal` lo reemplaza.
- **Bug real encontrado y corregido durante la verificación visual, no
  antes:** las etiquetas del eje X en la primera y última semana quedaban
  cortadas contra el borde del SVG (`textAnchor="middle"` centra el texto
  sobre un punto que ya está en el borde del área de trazado). Corregido
  usando `textAnchor="start"` en la primera etiqueta y `"end"` en la
  última, `"middle"` en las intermedias.
- **Verificación sin credenciales reales de Google en este entorno:**
  este sandbox no tiene acceso a la API de Vercel para recuperar
  `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` de producción (a
  diferencia del refresh token, que sí se pudo traer de la fila de
  `settings` vía la Management API de Supabase, como en rondas
  anteriores) — sin esas credenciales, `obtenerAccessTokenGoogle` no
  puede canjear el refresh token real, así que no se pudo repetir el
  patrón habitual de probar contra la cuenta real de Gonfernic para este
  cambio puntual. En su lugar se montó una ruta temporal
  (`app/resultados/tmptest`, eliminada al terminar) que renderizó
  `TendenciaFuentesIA` con datos representativos de dos fuentes y cuatro
  semanas, logueado como usuario real (`marcel@bigbuda.com`) contra
  Postgres local con Playwright: layout, colores por fuente, leyenda,
  marcadores circulares, etiquetas de semana (incluido el fix de recorte)
  y tooltip con crosshair al hacer hover confirmados visualmente contra
  el diseño del panel de referencia. La lógica de agrupamiento en sí
  (`armarTendenciaSemanal`, `isoSemana`) es determinística y no depende de
  ninguna API — el riesgo real quedaba en el componente visual, que sí se
  verificó. Typecheck, lint y los 17 tests de vitest en verde. Si se
  necesita repetir la verificación contra datos reales de Gonfernic más
  adelante, hace falta acceso a las credenciales OAuth de Google de
  producción (Vercel) desde el entorno que la corra.

**GA4 de la landing de Google Ads, separado del GA4 del sitio** — pedido
explícito del usuario: las campañas de Google Ads no apuntan al sitio
principal del cliente sino a una landing page propia, con su propia
propiedad GA4 para medir el tráfico pagado. Hasta esta ronda la sección
Google Ads (Resultados §3.15 y el pre-llenado de informes §3.4) reusaba
`ga4_property_id` (la propiedad del sitio, usada por SEO/AEO) — de ahí la
discrepancia grande ya documentada más arriba (122,5 conversiones en
Google Ads nativo vs. 1 en GA4). Meta Ads no tiene este problema porque se
conecta por token (Meta Insights API), no vía GA4.

- Migración `0013_google_ads_ga4_property.sql`: nueva columna
  `clients.google_ads_ga4_property_id`, aditiva (`ga4_property_id` sigue
  existiendo tal cual, para SEO/AEO). Aplicada contra producción vía la
  Management API de Supabase, igual que las migraciones anteriores.
- `IntegracionesPanel.tsx` separa el campo en dos: "GA4 Property ID
  (sitio principal)" y "GA4 Property ID (landing de Google Ads)", con una
  nota explicando por qué son distintos. `guardarConfigApis`
  (`lib/data/cliente-actions.ts`) persiste ambos por separado.
- `seccionGoogleAds` (`lib/data/resultados.ts`) y la rama `google_ads` de
  `prellenarAdsDesdeApis` (`lib/informes/prellenado-apis.ts`) ahora leen
  `google_ads_ga4_property_id` — **sin fallback** al GA4 del sitio: si no
  está configurado, la sección/el pre-llenado de Google Ads muestra
  "configura el GA4 de la landing" en vez de seguir mostrando datos del
  GA4 equivocado. El importador de JSON del dashboard anterior
  (`integraciones-actions.ts`) no se tocó — el export del dashboard viejo
  nunca tuvo este campo separado, así que no hay nada que mapear todavía.
- **Cambio de comportamiento en clientes reales existentes:** en
  producción, Tecny Stand y Gonfernic tienen Google Ads activo y
  `ga4_property_id` configurado (el del sitio) pero no
  `google_ads_ga4_property_id` — con este cambio, su sección Google Ads en
  Resultados y el pre-llenado del informe de Google Ads van a mostrar
  "configura el GA4 de la landing" hasta que se complete ese campo con la
  propiedad GA4 real de cada landing, desde la ficha de cada cliente.
- Verificado de punta a punta contra Postgres local + `next dev` real: con
  un cliente de prueba (Provetec Mining, mismo shape SEO+Google Ads) que
  tenía el GA4 del sitio configurado pero no el de la landing, la sección
  Google Ads mostró correctamente "Configura el GA4 Property ID de la
  landing de Google Ads en la ficha del cliente" (no reusó el GA4 del
  sitio); tras completar el campo nuevo desde el panel de integraciones y
  confirmar el guardado en la base, la misma sección pasó a intentar la
  llamada real a la API (degradando a "no se pudo obtener datos", esperado
  sin credenciales OAuth de Google en este entorno — mismo comportamiento
  que la sección AEO con la propiedad del sitio). Typecheck, lint y los 17
  tests de vitest en verde. Datos de prueba limpiados de la base al
  terminar.

**Bug real reportado por el usuario — "Costo por resultado"/"Costo por
conversión" mostraba "0 USD"/"0 CLP" en vez del valor real:** con Tecny
Stand real (302 USD de inversión / 2.167 resultados de Meta Ads),
`fmtMoneda` (`lib/data/resultados.ts`, duplicada en
`components/resultados/TablaCampanas.tsx` y
`lib/informes/prellenado-apis.ts`) hacía `Math.round(n)` antes de
formatear — 302/2.167 = USD 0,14, que al redondear a entero da 0. Distinto
del caso de Google Ads reportado en la misma ronda (ese sí era falta de
dato real desde GA4, `advertiserAdCost` en 0 por falta de vinculación
Ads↔GA4): acá el dato SÍ estaba, solo se perdía al formatear. Corregido en
las tres copias: `n.toLocaleString("es-CL", { maximumFractionDigits: 2 })`
en vez de `Math.round(n).toLocaleString(...)` — agrega decimales solo
cuando el valor real los tiene, así que montos grandes (inversión,
presupuestos, "Costo" de Google Ads en CLP) se siguen mostrando como
enteros. Verificado por cálculo directo (302/2.167 → "0,14 USD", 302 →
"302", 900.000 → "900.000", sin necesidad de repetir el ritual de Postgres
local + Playwright para un cambio puro de formato de texto sin lógica de
datos de por medio). Typecheck, lint y los 17 tests de vitest en verde.

**Fase 4 iniciada — llenado narrativo de informes con IA (§3.4 "asistencia
de IA"):** pedido explícito del usuario, "la idea es que se llenen
solos". El pre-llenado numérico (§3.14) ya cubre GSC/GA4/Meta; lo que
faltaba era el contenido de texto libre (resumen ejecutivo, enfoque,
insight de negocio, hoja de ruta, etc.), que hasta ahora el equipo
escribía siempre a mano.

- `lib/informes/generacion-ia.ts` (nuevo) llama a la API de Anthropic
  (`claude-opus-5`, salidas estructuradas vía `client.messages.parse` +
  schema de Zod — `@anthropic-ai/sdk` y `zod` agregados como dependencias
  nuevas) para generar el contenido narrativo, enganchado en `crearInforme`
  (`lib/data/informes-actions.ts`): se dispara **automáticamente** al crear
  un borrador nuevo (no al duplicar, igual que el pre-llenado numérico),
  después de calcular los datos reales del período — nunca antes, porque
  el texto generado tiene que poder referenciar esos números tal cual.
- **Alcance deliberado, no todo el informe**: se generan todas las
  secciones narrativas de ambos formatos (SEO: "En una frase", "Nuestro
  enfoque", "Lo que dejamos funcionando", "El detalle", "Impacto
  proyectado", "Hoja de ruta"; Ads: "¿Qué mejoramos?" reescrito en
  lenguaje de negocio y "¿Qué proyectamos?" + insight) **excepto**
  `resultadosNumeros.cifras` y `antesDespues` (SEO) — ambas piden cifras o
  textos "antes vs. después" puntuales (un título de página real antes y
  después, un número base al inicio del contrato) que la plataforma no
  captura en ningún lado todavía; pedirle a la IA que las completara de
  todas formas habría sido fabricar datos concretos para un informe real
  de cliente. Quedan en blanco, como antes, para que el equipo las
  complete a mano si tiene el dato real — decisión de correctitud, no un
  descuido.
- **Grounding estricto contra fabricación**: el prompt de sistema prohíbe
  explícitamente inventar cifras, nombres o hechos que no estén en los
  datos entregados (bitácora del período — resumen/hallazgos/próximos
  pasos de `optimizations` — más los números ya reales de GSC/GA4/Meta o
  Meta Insights ya calculados) y pide reutilizar esos números tal cual, no
  redondearlos distinto. Mismo motivo por el que el brief ya insistía en
  "siempre editable; nunca se envía sin revisión humana" — acá además se
  intenta que lo que la IA proponga ya sea fiel a los datos reales, no
  solo revisable después.
- **Resiliencia igual que el resto de §3.14**: si `ANTHROPIC_API_KEY` no
  está configurada o la llamada falla, `generarNarrativaSeo`/
  `generarNarrativaMarketing` devuelven `{}` sin lanzar — el informe se
  crea igual, con las secciones narrativas vacías (mismo comportamiento
  que antes de esta ronda), nunca rompe la creación del borrador.
  `ANTHROPIC_API_KEY` ya estaba anticipada en `.env.example` desde antes
  ("Fase 4 — asistencia de IA en informes") pero nunca se había usado.
- **Verificado de punta a punta contra Postgres local + `next dev` real,
  sin clave real de Anthropic en este entorno** (este sandbox no tiene
  `ANTHROPIC_API_KEY` ni una sesión de `ant auth login` — no se pudo
  repetir el patrón habitual de probar contra una llamada real): se creó
  un borrador SEO y uno de Google Ads para un cliente de prueba
  (Provetec Mining) con Playwright logueado como admin, confirmando que
  `crearInforme` sigue funcionando exactamente igual que antes (redirige
  al editor, sin errores de consola, sin bloquear ni demorar la creación
  — ambas corridas bajo 2 segundos, lo que confirma que la ausencia de
  clave hace un `return {}` inmediato en vez de intentar la llamada) y
  que el pre-llenado numérico/de bitácora ya existente sigue intacto.
  Typecheck, lint y los 17 tests de vitest en verde. Datos de prueba
  (los dos informes creados) borrados de la base al terminar. **Falta:**
  agregar `ANTHROPIC_API_KEY` en las variables de entorno de Vercel para
  que la generación funcione en producción — sin acceso a la API de
  Vercel desde este entorno, no se pudo hacer ni confirmar por esta vía.

**Generación de informes completamente automática, sin botón** — feedback
directo del usuario tras la ronda anterior: "aun queda muy manual, necesito
que sea completamente automático... es importante que se haga la
comparación con el período anterior para que los números tengan contexto
y no sean solo cifras sueltas". Dos cambios: (1) crear el borrador deja de
depender de que alguien apriete "Crear borrador", y (2) las cifras de
"Punto de partida" (SEO) ahora llevan la comparación contra el mes
anterior, tanto en el informe como en lo que lee la IA.

- `crearInforme` (`lib/data/informes-actions.ts`) se partió en dos: la
  lógica real —consulta de existente, pre-llenado numérico, generación
  narrativa, insert— queda en `crearInformeInterno` (exportada, sin
  `redirect()` ni `requireUser()`, así la puede llamar tanto el formulario
  manual como un cron o un hook sin sesión de usuario ni contexto de
  página); `crearInforme(formData)` queda como un wrapper delgado sobre
  ella para el botón "Crear borrador", que se mantiene por si alguien
  necesita forzar la creación de uno puntual (ej. para duplicar un
  informe viejo como base).
- **SEO-AEO-GEO: se genera el mismo día, enganchado en el registro real**
  (§3.2: "cada optimización incluye el envío de informe... ese mismo
  día"), no con un cron — `guardarRegistroSeo` (`lib/data/registro-seo-actions.ts`)
  llama a `crearInformeInterno` justo después de marcar la optimización
  como realizada, con el mes/año de hoy (`hoySantiago()`). Nunca bloquea
  ni revierte el registro si falla (try/catch): la optimización ya quedó
  guardada, el informe es un paso adicional.
- **Meta/Google Ads: cron diario, primera semana del mes** (§3.2: "la
  plataforma genera el evento... en la primera semana de cada mes
  (configurable)") — no hay un evento único que dispare el informe de Ads
  como sí lo hay para SEO (el trabajo es semanal, el informe es mensual),
  así que necesita un cron real. `lib/informes/auto-generar.ts` +
  `app/api/cron/generar-informes/route.ts` (mismo patrón de auth que
  `reintentar-sync`: `Authorization: Bearer $CRON_SECRET`), agregado a
  `vercel.json` en un horario distinto al cron existente (13:00 UTC, ~09:00
  Chile, contra las 12:00 UTC del otro) para no competir por el mismo
  minuto. "Primera semana" queda hardcodeado a 7 días (default del brief,
  sin pedido de hacerlo configurable — `DIAS_PRIMERA_SEMANA` en el mismo
  archivo). Ambos caminos son idempotentes por el mismo motivo que ya
  usaba `crearInforme`: el índice único (cliente, tipo, período) hace que
  una segunda llamada devuelva el informe existente en vez de duplicar,
  así que el cron puede correr todos los días sin control de estado
  propio — simplemente no encuentra nada pendiente la mayoría de los
  días.
- **Comparación contra el mes anterior en "Punto de partida" (SEO)** —
  hasta esta ronda, `prellenarSeoDesdeApis` solo traía el mes actual de
  GSC; el campo `descripcion` de cada métrica (pensado en el modelo de
  datos para "explicación de una línea") quedaba siempre vacío. Ahora trae
  también el mes anterior (mismo patrón que ya usaba Resultados,
  `limitesMesAnterior` ya existía en este archivo) y llena `descripcion`
  con el delta: porcentaje para CTR/impresiones/clics, diferencia absoluta
  con "mejoró"/"empeoró" para posición media (bajar el número es mejorar,
  a diferencia de las otras tres). Ese mismo texto lo lee después
  `generarNarrativaSeo` (antes solo mandaba `etiqueta: valor` a la IA, sin
  ningún contexto de dirección) — la regla del prompt de sistema también
  se actualizó para exigir explícitamente que el insight use esa dirección
  y nunca invente una comparación si el dato entregado dice "sin dato del
  mes anterior". El resumen de Ads (`comoVamosCifras`) ya traía deltas
  desde la ronda de pre-llenado original — no necesitó cambios.
- **Alcance deliberado, no tocado en esta ronda**: `traficoIA` (tráfico
  desde fuentes de IA en el informe SEO) sigue sin delta — el tipo
  `InformeSeoContenido.traficoIA` no tiene un campo de texto libre donde
  ponerlo sin una migración de datos, y el usuario pidió "más simple";
  queda como mejora futura si hace falta.
- **Verificado de punta a punta contra Postgres local + `next dev` real**
  (sin `ANTHROPIC_API_KEY` ni credenciales OAuth de Google reales en este
  entorno, mismo motivo de siempre): el flujo real "Registrar optimización
  SEO" (Provetec Mining, vía Playwright) creó el informe de agosto
  automáticamente sin ningún clic adicional, en ~1,4s; una segunda llamada
  directa a `crearInformeInterno` para el mismo cliente/período devolvió
  el mismo id sin duplicar. Las fórmulas de delta se verificaron por
  cálculo directo (clics 120 vs. 100 → "+20%", posición 4.2 vs. 6.5 →
  "mejoró 2.3 posiciones", sin mes anterior → "sin dato del mes
  anterior"). El cron de Ads se probó contra el endpoint HTTP real (no
  invocando la función directamente, para no repetir el bug ya documentado
  de `proxy.ts`/`revalidatePath` fuera de contexto de request): sin auth y
  con secret incorrecto devuelve 401; con el secret correcto detectó
  correctamente los 3 servicios de Ads sin informe de agosto (Provetec
  Mining · Google Ads, Tecny Stand · Meta Ads y Google Ads), los creó, y
  una segunda corrida no volvió a crear nada; con el gate de "primera
  semana" en su valor real (7 días) y la fecha real de hoy (26 de agosto),
  el cron correctamente no evaluó ni creó nada. Typecheck, lint y los 17
  tests de vitest en verde. Datos y configuración de prueba (informes,
  estado de la optimización de registro, `gsc_property` temporal)
  revertidos al terminar.

**Bug real reportado por el usuario — la bajada de la portada no se
generaba sola:** al revisar el borrador automático, la sección "Portada"
quedaba con "Bajada" vacía, a pesar de que el resto del contenido
narrativo sí se generaba. Causa: un descuido de alcance en la ronda
anterior — `NarrativaSeoSchema`/`NarrativaMarketingSchema`
(`lib/informes/generacion-ia.ts`) nunca incluyeron el campo `bajada`, así
que la IA nunca lo generaba aunque estuviera dentro del alcance previsto
("todo el contenido narrativo"). Corregido agregando `bajada` a ambos
schemas y al objeto que devuelven `generarNarrativaSeo`/
`generarNarrativaMarketing`, preservando los `chips` ya existentes del
contenido pre-llenado (`{ ...prellenado.portada, bajada: parsed.bajada }`
— la IA no genera chips, son etiquetas fijas de servicio). Mismo
aprovechado para confirmar que ningún cambio reciente tocó el diseño del
informe (plantilla dorada/oscura de Claude Design): `lib/informes/slides-seo.ts`/
`slides-marketing.ts` no se modificaron desde que se construyeron
originalmente (11 de agosto) — lo que el usuario veía en la captura era
el panel del editor (formulario claro, consistente con el resto de la
plataforma), no la plantilla del informe en sí. Typecheck, lint y los 17
tests de vitest en verde — sin repetir el ritual de Postgres local +
Playwright porque el cambio reutiliza exactamente el mismo mecanismo
(schema de Zod + merge en el objeto de retorno) ya verificado
end-to-end en la ronda anterior, y este entorno sigue sin
`ANTHROPIC_API_KEY` real para probar la llamada en vivo de todas formas.

**La IA ahora lee toda la bitácora real y las reuniones con el cliente,
no solo los resúmenes de optimización** — pedido explícito del usuario
tras confirmar que `ANTHROPIC_API_KEY` ya estaba activa en producción:
"crea un informe y ve cómo puedes automatizarlo completo, pensando que en
la bitácora estará anotado todo lo que hemos hecho y también están
adjuntas las reuniones que hemos tenido con el cliente". Hasta esta
ronda, el contexto que recibía la IA (`obtenerBitacoraTexto`) solo leía
`optimizations.resumen/hallazgos/proximos_pasos` del servicio — se perdía
todo lo demás que ya vive en la bitácora real: informes enviados,
descuentos terminados, hitos de onboarding, avances del bloque de
miércoles (todo lo que ya escribe `log_entries`, el espejo interno de
§3.3), y las reuniones con notas (`meetings`, §4.2 fuera del brief
original) no se leían en absoluto.

- `obtenerBitacoraCompleta` (`lib/informes/generacion-ia.ts`) reemplaza a
  `obtenerBitacoraTexto`: trae `log_entries` completo del cliente en el
  período (no filtrado por servicio — ni `log_entries` ni `meetings` se
  registran por servicio en el modelo de datos) más las reuniones ya
  `realizada`s con `notas`, como dos bloques separados en el prompt
  ("Bitácora del período" y "Reuniones con el cliente en el período") —
  separados a propósito, para que la IA pueda distinguir trabajo operativo
  de conversaciones con el cliente. `generarNarrativaSeo`/
  `generarNarrativaMarketing` dejan de recibir `serviceId` (ya no se usa
  para nada dentro de esta función) — mismo motivo, alcance client-wide.
- Regla nueva en el prompt de sistema: las notas de reuniones son
  información interna para dar contexto (qué pidió el cliente, qué se
  acordó), no texto para copiar tal cual ni para mencionar explícitamente
  que hubo una reunión — evita que el informe termine sonando a "leímos
  el acta de la llamada" en vez de un informe de resultados.
- **Intentando "crear un informe" real en producción para probarlo de
  punta a punta:** con el token de Vercel que compartió el usuario para
  esta ronda se confirmó que `ANTHROPIC_API_KEY` existe, apunta a
  `production`, y que el último deployment (el de esta misma rama) se
  construyó *después* de que se agregó la variable — no hace falta
  redeploy. Pero generar un informe real requiere invocar la acción real
  del servidor (con sesión de usuario) o el cron real (con
  `CRON_SECRET`) — ninguno de los dos accesibles con el token de Vercel
  (que no puede desencriptar env vars "sensitive": se probó
  `?decrypt=true` contra `ANTHROPIC_API_KEY` y devolvió vacío, 200 pero
  sin valor). Además el cron de Ads no habría creado nada de todas formas
  hoy (26 de agosto, fuera de la primera semana del mes, el gate
  `DIAS_PRIMERA_SEMANA` lo bloquea a propósito). Queda pendiente que el
  usuario dispare la creación real (un clic en "Crear borrador", o
  registrar una optimización SEO real) para poder confirmar el resultado
  contra producción.
- Verificado localmente lo que sí se pudo probar sin la API real de
  Anthropic: la consulta SQL de `obtenerBitacoraCompleta` corrida directo
  contra Postgres local con datos de prueba (una entrada de bitácora +
  una reunión con notas para Provetec Mining, agosto 2026) devolvió las
  filas esperadas con el cast `creado_en::date` correcto (mismo cuidado
  que ya documentado para el cron de reintento, §4.3); el formato final
  del texto se confirmó por cálculo directo. `crearInformeInterno` se
  volvió a probar de punta a punta contra Postgres local + `next dev`
  real con las nuevas firmas de función (sin `serviceId`) — sigue creando
  el informe correctamente. Typecheck, lint y los 17 tests de vitest en
  verde. Datos de prueba limpiados de la base al terminar.

**Bug real reportado por el usuario — "Registrar optimización" tiraba 404
en Tecny Stand:** el botón del encabezado de la ficha de cliente
(`ClienteView.tsx`) apuntaba a `/clientes/{id}/registro-seo` — una ruta
que **nunca existió**. Rastreado hasta el primer import del diseño de
Claude Design (3 de agosto): quedó como link de maqueta sin conectar a
una página real, y como toda verificación anterior entraba al flujo de
registro por el calendario (`/optimizaciones/{id}/registro`, con el id
correcto) o directo por id desde la base, nunca se probó este botón
específico — rompía para **todos los clientes**, no solo Tecny Stand, que
además no tiene servicio SEO contratado (ahí el botón nunca debería
aparecer). Corregido: `getClienteDetalle` (`lib/data/cliente-detalle.ts`)
ahora trae `proximaOptimizacionSeoId` (la próxima optimización SEO
`programada` de ese cliente, si tiene una) y el botón usa ese id para
armar el link real (`/optimizaciones/{id}/registro`) — si no hay ninguna
pendiente (cliente sin SEO contratado, o con SEO pero nada programado
todavía por onboarding sin completar), el botón no se muestra en vez de
llevar a un 404. Verificado con Playwright contra Postgres local: Provetec
Mining (con una optimización SEO pendiente) muestra el botón, el link
apunta al id real, y el clic llega a la página de registro real, no a un
404; Tecny Stand (solo Ads, sin SEO contratado) no muestra el botón.
Typecheck, lint y los 17 tests de vitest en verde.

**El checklist de onboarding se crea al dar de alta, no al abrir la
ficha** — pedido explícito del usuario: "todos los clientes al darles de
alta se debe crear el checklist de onboarding automáticamente y las
listas de optimización, después vamos a refinar el checklist". Se
consultó el alcance antes de tocar nada, porque programar la primera
optimización sin esperar el onboarding revierte una protección explícita
del brief (§3.8: "la primera optimización no se programa hasta que los
ítems bloqueantes estén completos") — el usuario confirmó que solo quiere
el checklist inmediato; la traba sobre la primera optimización se
mantiene tal cual.

- `instanciarOnboarding` (`lib/data/onboarding.ts`) ahora se exporta y se
  llama desde `crearCliente` (`lib/data/clients-actions.ts`) justo
  después de insertar los servicios del cliente nuevo (la función decide
  qué plantillas aplican leyendo esos servicios, por eso el orden
  importa). Antes solo se llamaba perezosamente desde
  `getOnboardingCliente`, al abrir la ficha por primera vez — se mantiene
  como fallback idempotente (ya lo era: revisa `checklist_instances`
  existentes antes de insertar) para clientes viejos que nunca abrieron
  su ficha, y para cuando se agrega un servicio nuevo a un cliente
  existente.
- No cambia nada más: el checklist instanciado queda igual de "en
  progreso" con sus ítems en `pendiente`/`bloqueante` según la plantilla;
  `activarPrimeraOptimizacionSiCorresponde` sigue siendo el único que
  programa la primera optimización, y sigue exigiendo que los ítems
  bloqueantes estén completos (o que un admin lo fuerce).
- Verificado con Playwright contra Postgres local: se dio de alta un
  cliente de prueba nuevo con servicio SEO-AEO-GEO desde el formulario
  real ("Nuevo cliente"), y sin abrir la ficha después del alta (la
  redirección automática a la ficha no cuenta para esto — la instancia ya
  quedó creada dentro de la propia acción `crearCliente`, antes del
  `redirect()`, por el orden determinístico de ejecución) se confirmó
  directo en la base: 2 `checklist_instances` (`Onboarding común` +
  `Onboarding SEO · AEO · GEO`), ambas `en_progreso`, con sus ítems en
  `pendiente` — nada programado en `optimizations` todavía, como
  corresponde. Typecheck, lint y los 17 tests de vitest en verde. Cliente
  de prueba borrado (cascada a servicios/checklist) al terminar.

**Próximo paso:** con Fase 3 cerrada y la generación de informes
completamente automática, sigue el resto de Fase 4 — repositorio de
prompts con versionado y variables, flujo de aprobaciones (§3.11),
offboarding (§3.12), retrospectiva mensual del área (§3.13) y KPIs de
operación.

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
