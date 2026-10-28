# Plan: API de Google Ads en Kaizen

Objetivo: reemplazar el proxy de GA4 (sessionSource=google / medium=cpc) por los datos reales de
Google Ads en Resultados, informes, la alerta "sin conversiones ayer" y el briefing de la
optimización. Hoy GA4 no coincide con Ads (otra atribución, costo en 0 sin vínculo, campañas
"(not set)").

## Lo que hay que conseguir (fuera del código)
1. **Cuenta de administrador (MCC) propia de Bigbuda.** Hoy no existe: las cuentas de Ads son de
   cada cliente y están separadas. El developer token solo se emite desde una cuenta de
   administrador, así que hay que crear una (gratis) con paulete@bigbuda.com. Las cuentas de los
   clientes pueden seguir siendo de ellos: sirve que el usuario de Google que conecta Kaizen tenga
   acceso directo a cada cuenta (invitado como usuario), y/o vincularlas al MCC (el cliente acepta
   una invitación; con eso se usa `login-customer-id`). Para solicitar acceso básico Google pide
   cuentas vinculadas: empezar vinculando una (p. ej. Tecny Stand).
2. **Developer token**: se pide en el *Centro de API* del MCC (solo visible logueado en esa cuenta).
   Nace con acceso de prueba (solo cuentas de prueba); para cuentas reales hay que solicitar
   **acceso básico** con un formulario (requiere email de contacto de API al día). La revisión puede
   demorar días. Un resultado de búsqueda mencionó que Google estaría cambiando los tokens en
   2026: confirmar en la documentación vigente antes de pedirlo.
3. **Scope nuevo en el OAuth de Google**: `https://www.googleapis.com/auth/adwords`. Hay que
   habilitar la *Google Ads API* en el proyecto de Google Cloud y volver a conectar la cuenta en
   Ajustes (hoy solo tiene Search Console y Analytics). La persona que conecte debe tener acceso
   a las cuentas de Ads (idealmente al MCC).
4. **ID de cliente de Ads de cada cliente** (10 dígitos, sin guiones) para cargarlo en su ficha.

## Lo que se construye
- **Fase A — conexión y lectura básica**: migración con `clients.google_ads_customer_id`,
  `settings.google_ads_login_customer_id`; variable de entorno `GOOGLE_ADS_DEVELOPER_TOKEN`;
  cliente REST (`lib/google/ads.ts`) con `searchStream` + GAQL; campo en la ficha; botón de
  prueba de conexión. Si el cliente no tiene ID, todo sigue funcionando con el proxy de GA4.
- **Fase B — datos en Kaizen**: resumen y campañas (costo, clics, impresiones, conversiones,
  CPA, cuota de impresiones perdida por presupuesto/ranking) en Resultados; serie diaria; el
  costo real para el pacing automático y el informe; la alerta "sin conversiones ayer" con
  conversiones de Ads (no de GA4). Misma resiliencia de siempre: snapshot en
  `metric_snapshots`, sin mezclar formas bajo la misma clave.
- **Fase C — briefing**: términos de búsqueda, keywords con nivel de calidad, fuerza de los
  anuncios, recomendaciones/aplicación automática y historial de cambios dentro del briefing de
  Google Ads, para que Claude no tenga que revisarlos a mano en la cuenta.
- **Fase D (después)**: ejecutar cambios con aprobación por acción (mutate), solo con la
  lectura estable.

## Decisiones
- Solo lectura al inicio; nada escribe en Ads hasta la fase D.
- Versión de la API: confirmar la vigente al implementar (no fijarla de memoria).
- Monedas: Ads reporta en la moneda de la cuenta; mostrarla tal cual, sin convertir.
