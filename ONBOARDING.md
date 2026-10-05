# Bienvenido a Kaizen Bigbuda

Esta es la plataforma interna de mejora continua del área de Marketing de Bigbuda — dashboard y planificador de clientes, integrada con ClickUp, con generador de informes y una pestaña de resultados en vivo conectada a Search Console / GA4 / Meta.

Esta guía recorre **cada sección real de la app**, con los archivos donde vive el código. Para el historial completo y detallado de cada decisión, bug real encontrado y cómo se verificó, lee `CLAUDE.md` en la raíz del repo — es el diario de desarrollo completo del proyecto, ronda por ronda, y la fuente de verdad sobre qué está hecho, qué falta y por qué se decidió así.

## Cómo entrar

Login propio por email (`/login`, sin OAuth de terceros para el equipo) con dos roles: `admin` (acceso completo — finalizar clientes, eliminar descuentos/aprobaciones, editar `/ajustes`) y `miembro` (operación diaria). El control de acceso se revisa server-side en cada acción destructiva, no solo se oculta en la UI. `lib/auth/`.

---

## Recorrido por sección (sidebar)

### 1. Dashboard (`/dashboard`, `lib/data/dashboard.ts`)

La portada operativa: "Hoy"/"Esta semana" (qué optimizaciones tocan, con quién), y un panel de alertas que agrupa — en una sola consulta por categoría, sin llamadas en vivo a APIs externas — descuentos y servicios por vencer, optimizaciones atrasadas, informes pendientes de envío, registros `pendiente_sync` a ClickUp, onboarding estancado, desviaciones de pacing, aprobaciones sin respuesta, conflictos de feriado/ausencia, optimizaciones bloqueadas por aprobación, "completada en ClickUp pero sin registrar", y "sin conversiones ayer" (la única que lee un snapshot cacheado de un cron diario, nunca llama a Meta/GA4 en el momento — ver más abajo, Cron Jobs).

### 2. Calendario (`/calendario`, `components/calendario/CalendarioView.tsx` + `MonthGrid.tsx`)

Vista mensual con drag & drop de las optimizaciones programadas. Todo lo que aparece acá lo genera el **motor de scheduling** (`lib/scheduling/`, puro, 21 tests vitest):

- **Regla A (SEO-AEO-GEO)** — `seo.ts`: 1 optimización al mes por cliente, solo viernes, máx. 2 por viernes, asignación estable mes a mes ("su" viernes ordinal) vía bucket-fill.
- **Regla B (Ads)** — `ads.ts`: cada servicio de Meta/Google Ads (tratados por separado) se revisa una vez por semana en su propio día asignado (lunes-viernes, sin hora fija) — mismo bucket-fill que SEO, sin tope por día.
- **Regla D (feriados/ausencias)** — `holidays.ts` + `ausencias.ts`: reprograma automáticamente al día hábil más cercano si cae en feriado; si el responsable está ausente, el dashboard alerta y permite reasignar en un clic.
- `engine.ts` orquesta todo para `scripts/seed.ts`; en producción cada regla se dispara desde el flujo real (alta de cliente, registro de optimización, agregar feriado) — no hay un solo "generador mensual" central.

### 3. Clientes (`/clientes`, ficha en `/clientes/[id]`)

El CRUD central. La ficha de cada cliente (`components/clientes/ClienteView.tsx`) agrupa paneles independientes:

- **`ServiciosPanel.tsx`** / **`DescuentosPanel.tsx`** — servicios contratados (SEO-AEO-GEO / Meta Ads / Google Ads, cada uno con su propia vigencia) y descuentos, con alertas de vencimiento configurables desde `/ajustes`.
- **`OnboardingPanel.tsx`** — checklist de onboarding por servicio (ítems bloqueantes impiden la primera optimización hasta completarse, salvo override de admin). Se crea automáticamente al dar de alta el cliente.
- **`OffboardingPanel.tsx`** — checklist de cierre cuando el cliente se da de baja, retención de datos y eliminación de datos de contacto (Ley 21.719).
- **`AprobacionesPanel.tsx`** — solicitudes de aprobación al cliente (creativo/presupuesto/copy/otro); una aprobación puede bloquear una optimización pendiente, con el motivo visible.
- **`IntegracionesPanel.tsx`** — los IDs de GSC/GA4 (sitio y, por separado, landing de Google Ads)/Meta Ad Account/token alternativo de Meta. Esto es lo que alimenta la pestaña Resultados y el pre-llenado de informes (ver abajo).
- **`ReunionesPanel.tsx`** (+ `/reuniones/[id]`) — reuniones con el cliente, con notas; aparecen como chip en el calendario.
- **`BitacoraPanel.tsx`** (+ `/clientes/[id]/bitacora`) — timeline cronológico de todo lo registrado para ese cliente, espejo interno de lo que se escribe en ClickUp (ver integración ClickUp más abajo).
- Botones "Registrar SEO"/"Registrar Ads" llevan al flujo real de registro (ver siguiente punto).

### 4. Registro de optimizaciones

- **SEO** — `/optimizaciones/[id]/registro` (`components/registro-seo/`): resumen, hallazgos, próximos pasos, checklist estándar de la optimización. Al guardar: dispara bitácora (ClickUp + interna), cierra la tarea en ClickUp, y genera el informe del mes automáticamente (ver Informes).
- **Ads** — `/optimizaciones/bloque/[fecha]` (`components/bloque/`): agrupa todos los servicios de Ads que tocan ese día; cada uno se completa por separado con su propia nota, gasto del mes (con creación de `budgets` si no existía fila), y pacing automático si hay dato real de API. Al completar, genera la siguiente optimización semanal sola (misma recurrencia sin cron).

### 5. Informes (sin link propio en el sidebar — se entra desde la ficha del cliente → "Informes", `/clientes/[id]/informes`)

Generador de borradores con el diseño de marca (`lib/informes/`, HTML/CSS propio — no JSX con objetos de estilo, exporta a PDF imprimiendo desde el navegador):

- **Formato SEO-AEO-GEO** (13 slides, `slides-seo.ts`) y **formato Ads reducido** (6 slides, `slides-marketing.ts`) por servicio.
- **Informe combinado Meta Ads + Google Ads** (`slides-ads-combinado.ts`) para un cliente con ambos servicios activos a la vez — un solo informe en vez de dos, con un slide de comparación directa entre canales.
- **Pre-llenado automático** desde las mismas APIs de Resultados (ver sección 6) + bitácora del período — nunca manual salvo que la API falle.
- **Narrativa generada con la API de Anthropic** (`generacion-ia.ts`): resumen ejecutivo, insight de negocio, hoja de ruta — con grounding estricto contra inventar cifras, siempre editable antes de enviar.
- **Generación completamente automática, sin botón**: SEO se genera el mismo día del registro; Ads vía cron diario en la primera semana del mes (`lib/informes/auto-generar.ts`).
- Editor por secciones con autoguardado (`InformeEditorSeo.tsx` / `InformeEditorMarketing.tsx` / `InformeEditorAdsCombinado.tsx`), vista previa en vivo, vista de impresión (`/informes/[id]/imprimir`).

### 6. Resultados (`/resultados`) — lo más relevante si estás armando algo de seguimiento SEO-AEO-GEO

Dashboard en vivo conectado directo a las APIs reales (reemplaza un dashboard estático que la agencia ya tenía). `lib/data/resultados.ts` orquesta cuatro secciones independientes, cada una con su propio gate (sin servicio contratado / sin config en la ficha / API caída, tres mensajes distintos — nunca rompe la página):

- **SEO-AEO-GEO** — `lib/google/gsc.ts`: clics, impresiones, CTR, posición media, top keywords con delta vs. período anterior, distribución de posiciones. GSC tiene un retraso real de 2-3 días de procesamiento — `desplazarParaGsc` desplaza el rango solo para estas llamadas.
- **AEO·GEO (tráfico desde IA)** — `lib/google/ga4.ts`: tráfico desde ChatGPT/Perplexity/Gemini/Claude/Copilot, con nota al pie de por qué se subestima (varias de estas plataformas no mandan Referer). Tendencia semanal por fuente de IA con gráfico de línea propio.
- **Meta Ads** — `lib/meta/client.ts`: gasto, resultados, CPC/CTR, alcance, tabla de campañas con conversiones/CPA.
- **Google Ads** — vía GA4 filtrado `sessionMedium=cpc/paid` (no hay API de Google Ads propia conectada — limitación estructural documentada, no bug), con GA4 de la landing separado del GA4 del sitio principal.
- **Overlay de optimizaciones** — la funcionalidad diferencial: cada gráfico marca con línea+punto las fechas de optimizaciones realizadas e informes enviados, filtrado por servicio.
- **Insight de negocio por sección** (regla simple, no IA) y **funnel** impresiones→clics→conversión.
- Gráficos SVG a mano (`components/resultados/SerieTiempo.tsx`), sin librería de charts — un solo eje, nunca dual-axis.
- **Caché/resiliencia** (`lib/metricas/snapshot.ts`): cada métrica se guarda como snapshot histórico; si la API falla, usa el último snapshot con aviso de fecha.
- **OAuth de Google** (`lib/google/oauth.ts`): Authorization Code + PKCE con refresh token (no el implicit flow de 1 hora típico de dashboards caseros), con caché de access token en memoria + deduplicación de llamadas concurrentes.

### 7. Ajustes (`/ajustes`, solo-lectura para `miembro`)

Panel de configuración (`components/ajustes/`): workspace/lista default de ClickUp, días de alerta (descuento/servicio/aprobación/onboarding), umbral de pacing, conexión OAuth de Google, `FeriadosPanel.tsx` (con reprogramación retroactiva automática de lo ya programado), `AusenciasPanel.tsx`, e `ImportadorConfigDashboard.tsx` (migra configuración de GSC/GA4/Meta desde el JSON que exportaba el dashboard estático anterior de la agencia).

### 8. Prompts (`/prompts`)

Repositorio de prompts de trabajo con versionado completo (cada edición archiva la versión anterior), búsqueda full-text en español, variables (`{{cliente}}`/`{{url}}`/`{{mes}}`) resueltas al copiar.

---

## Arquitectura de integración (no son pantallas, pero sostienen todo lo de arriba)

- **ClickUp** (`lib/clickup/client.ts`): bitácora real (una página por cliente dentro de un Doc compartido), tareas de calendario (busca la lista del cliente dentro de la carpeta de su tipo de servicio), webhook `taskStatusUpdated` para sincronización bidireccional, y un job de reintento (`retry.ts`) para todo lo que queda `pendiente_sync`. Toda escritura es idempotente y corre en segundo plano con `after()` de Next.js — nunca bloquea la respuesta al usuario.
- **Cron jobs** (`vercel.json` + `app/api/cron/*`): reintento de sync a ClickUp (diario), generación automática de informes de Ads (diario, primera semana del mes), snapshot de conversiones de ayer (diario, alimenta la alerta del dashboard).
- **Base de datos**: Postgres vía Supabase, migraciones en `supabase/migrations/` (hoy van 17), aplicadas a producción vía la Management API de Supabase.

## Qué NO hace (alcance deliberado)

Pensado para el equipo interno de la agencia (admin/miembro), no para que el cliente final entre a verlo. No hay API de Google Ads propia conectada — se mide vía GA4 filtrado, con la limitación estructural ya documentada (no coincide con las conversiones nativas de Google Ads, que usan modelado estadístico y atribución cross-device).

## Cómo explorar esto con Claude

Si estás abriendo este proyecto en Claude Code, podés preguntar cosas como:

- "Explícame cómo funciona [cualquier sección de arriba], de punta a punta"
- "¿Cómo resuelve este proyecto el retraso de datos de Search Console?"
- "Mostrame el modelo de datos completo y qué tablas tocaría si agrego una integración nueva"
- "¿Qué le agregarías a esto si yo estuviera construyendo algo parecido solo para SEO-AEO-GEO?"
- "Buscá en CLAUDE.md todos los bugs reales que se encontraron en la sección de Resultados y cómo se corrigieron"

Claude puede leer el código real y `CLAUDE.md` (el historial completo de decisiones, bugs reales encontrados y cómo se verificó cada cosa) para responder con contexto real del proyecto, no en abstracto.
