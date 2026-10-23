# Agente de optimización ("Iniciar optimización") — plan

Decisiones del usuario: lectura de Meta + API real de Google Ads; el agente propone y
ejecuta con aprobación por acción; alcance Meta Ads/Google Ads (SEO después); chat dentro
de la optimización.

## Flujo
1. Botón "Iniciar optimización" en el bloque del día / ficha (optimización `programada`).
2. El agente carga primero el contexto histórico: las últimas ≥3 optimizaciones del servicio
   (resumen, hallazgos, próximos pasos, estado de cada acción), tareas pendientes, acciones
   "en espera de más datos" con su fecha de revisión, aprobaciones abiertas, pacing.
3. Audita la cuenta (solo lectura): campañas, conjuntos/anuncios, gasto, CPA, creativos
   fatigados, términos de búsqueda (Google), pacing vs. presupuesto.
4. Entrega un plan priorizado de la semana (impacto/esfuerzo), marcando qué acciones NO se
   tocan por estar esperando datos.
5. Chat para ajustar el plan; cada acción de escritura se propone y se ejecuta solo tras
   aprobar en la UI.
6. Al cerrar, el agente redacta el resumen → es el texto que va a la bitácora (ClickUp +
   interna) y queda como contexto de la próxima optimización.

## Fases
- **Fase 0 (ya, en paralelo)**: solicitar developer token de Google Ads (aprobación de
  Google, puede tardar semanas) y vincular cuentas (MCC). Revisar permisos del token de
  System User de Meta.
- **Fase 1 — lectura + plan + chat (Meta + GA4, Google vía GA4 mientras no haya token)**:
  tablas de sesión/mensajes/acciones propuestas, loop de agente con tool use
  (SDK de Anthropic ya instalado), memoria de las 3 últimas optimizaciones, UI de chat,
  resumen → bitácora.
- **Fase 2 — Google Ads API de lectura**: términos de búsqueda, anuncios, presupuestos.
- **Fase 3 — escritura con aprobación**: pausar/activar, cambio de presupuesto con tope %,
  siempre con registro de auditoría, idempotencia y botón de deshacer cuando se pueda.

## Riesgos / decisiones técnicas
- Duración: una auditoría larga excede el límite de función de Vercel → streaming y/o
  ejecutar con `after()`/pasos cortos por turno; persistir cada mensaje.
- Escritura en cuentas de clientes: permisos `ads_management` (Meta) y escritura en Google
  Ads; topes duros (p. ej. máx. ±X% presupuesto), nunca acción sin aprobación explícita.
- Grounding: el agente no inventa cifras; toda afirmación cita la herramienta/dato.
- Costos de API de Anthropic por sesión (contexto grande): resumir históricos.
