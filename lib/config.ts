/**
 * Las optimizaciones de posicionamiento (SEO · AEO · GEO) las lleva Marcel en
 * su propio sistema y los informes los envía él los días 28 de cada mes, así
 * que Kaizen no programa ni registra esas optimizaciones, no crea sus tareas
 * en ClickUp y no se las asigna a nadie. El servicio SEO sigue existiendo en
 * la ficha del cliente (vigencia, integraciones GSC/GA4) y la pestaña
 * Resultados sigue mostrando sus métricas para las reuniones con clientes.
 *
 * Si se suma alguien al equipo que lleve SEO dentro de Kaizen, cambiar a
 * `true`: los clientes nuevos vuelven a recibir su viernes y su primera
 * optimización al completar el onboarding. Las optimizaciones que la
 * migración 0020 dejó canceladas no se reactivan solas.
 */
export const OPTIMIZACIONES_SEO_EN_KAIZEN = false;

/**
 * El agente de optimización integrado (chat dentro de Kaizen) consume la API
 * de Anthropic, que se paga aparte de la suscripción de Claude. Mientras no
 * haya una key con saldo, la optimización se trabaja en modo manual: Kaizen
 * arma el briefing, la persona lo usa en Claude (claude.ai o la extensión) y
 * pega de vuelta el resultado. Se activa con `AGENTE_INTEGRADO=1`.
 */
export const agenteIntegradoActivo = () => process.env.AGENTE_INTEGRADO === "1";
