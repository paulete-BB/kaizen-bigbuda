# Bienvenido a Kaizen Bigbuda

Esta es la plataforma interna de mejora continua del área de Marketing de Bigbuda — dashboard y planificador de clientes, integrada con ClickUp, con generador de informes y una pestaña de resultados en vivo conectada a Search Console / GA4 / Meta.

Si estás explorando este proyecto porque estás armando algo parecido (por ejemplo una plataforma de seguimiento SEO-AEO-GEO), esta guía te orienta rápido sobre qué ya está resuelto y dónde mirar el código real. Para el historial completo y detallado de cada decisión, bug encontrado y verificación hecha, lee `CLAUDE.md` en la raíz del repo — es el diario de desarrollo completo del proyecto, ronda por ronda.

## Qué es esto, en una frase

Una web app (Next.js + Postgres/Supabase) que reemplaza la planificación manual dispersa de optimizaciones SEO/Ads por cliente, con bitácora automática en ClickUp, calendario con motor de scheduling propio, generador de informes con diseño de marca, y un dashboard de resultados en vivo conectado directo a las APIs reales (no a un dashboard estático aparte).

## Lo más relevante si estás pensando en seguimiento SEO-AEO-GEO

Esto es lo que probablemente más te interese revisar:

- **`lib/google/gsc.ts`** — cliente server-side de Google Search Console API: resumen, keywords (con `rowLimit` configurable), serie diaria, listado de propiedades. Nota clave: GSC tiene un retraso real de procesamiento de 2-3 días — `desplazarParaGsc` en `lib/data/resultados.ts` desplaza el rango de fechas para no subcontar clics/impresiones sin aviso.
- **`lib/google/ga4.ts`** — tráfico orgánico, tráfico desde fuentes de IA (ChatGPT, Perplexity, Gemini, Claude, Copilot — ver la lista de dominios ahí mismo y la nota sobre por qué se subestima: varias de estas plataformas no mandan Referer), tráfico pagado vía `sessionMedium`, desglose por campaña.
- **`lib/meta/client.ts`** — Meta Insights API: resumen de cuenta y por campaña, con el mismo criterio de "resultados" que un dashboard de ads real (prioriza landing/click/compra del píxel antes de sumar acciones a ciegas).
- **`lib/google/oauth.ts`** — OAuth 2.0 Authorization Code + PKCE con refresh token (no el implicit flow de 1 hora que tienen muchos dashboards caseros). Incluye caché del access token en memoria + deduplicación de llamadas concurrentes — hubo un bug real de producción por no cachearlo (ver CLAUDE.md, "la página se cae" / fan-out de Gonfernic).
- **`lib/metricas/snapshot.ts`** — el patrón de caché/resiliencia: cada métrica se guarda como snapshot histórico en `metric_snapshots`; si la API en vivo falla, se usa el último snapshot con aviso de fecha. Nunca rompe la página.
- **`app/resultados/page.tsx` + `lib/data/resultados.ts`** — la pestaña "Resultados": cuatro secciones (SEO, AEO/tráfico IA, Meta Ads, Google Ads), cada una con su propio gate (sin servicio contratado / sin config / API caída, tres mensajes distintos), overlay de optimizaciones sobre los gráficos (línea vertical + punto en la fecha de cada intervención real), insight de negocio por sección (regla simple, no IA), funnel, distribución de posiciones de keywords, tendencia semanal por fuente de IA.
- **`components/resultados/SerieTiempo.tsx`** — gráficos de línea con crosshair/tooltip a mano en SVG, sin librería de charts. Sigue una skill de dataviz interna (un solo eje, nunca dual-axis; paleta categórica fija por fuente).
- **`lib/informes/`** — generador de informes con diseño de marca (HTML/CSS propio, export a PDF vía impresión del navegador), pre-llenado automático desde las mismas APIs, y generación de contenido narrativo con la API de Anthropic (grounding estricto: nunca inventa cifras, solo reusa las ya calculadas).

## Qué NO hace (alcance deliberado)

Está pensado para el equipo interno de la agencia (admin/miembro), no para que el cliente final entre a verlo. No hay API de Google Ads propia conectada — Google Ads se mide vía GA4 filtrado (`sessionMedium=cpc/paid`), con una limitación estructural documentada (no coincide con las conversiones nativas de Google Ads, que usan modelado estadístico y atribución cross-device).

## Cómo explorar esto con Claude

Si estás abriendo este proyecto en Claude Code, podés simplemente preguntar cosas como:

- "Explícame cómo funciona el pre-llenado de métricas de un informe, de punta a punta"
- "¿Cómo resuelve este proyecto el retraso de datos de Search Console?"
- "Mostrame el modelo de datos completo y qué tablas tocaría si agrego una integración nueva"
- "¿Qué le agregarías a esto si yo estuviera construyendo algo parecido solo para SEO-AEO-GEO?"
- "Compará el patrón de caché de `metric_snapshots` contra [lo que tú estés construyendo]"

Claude puede leer el código real y `CLAUDE.md` (el historial completo de decisiones, bugs reales encontrados y cómo se verificó cada cosa) para responder con contexto real del proyecto, no en abstracto.
