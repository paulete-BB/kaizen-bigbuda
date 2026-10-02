import { conCacheDeSnapshot } from "@/lib/metricas/snapshot";
import { obtenerResumenGSC } from "@/lib/google/gsc";
import { obtenerTraficoIAGA4, obtenerTraficoPagadoGA4, type ResumenTraficoPagado } from "@/lib/google/ga4";
import { obtenerResumenMeta, type ResumenInsightsMeta } from "@/lib/meta/client";
import { criterioDeMetrica, criterioAFavorable } from "@/lib/informes/metricas-catalogo";
import type { InformeAdsCombinadoContenido, InformeMarketingContenido, InformeSeoContenido } from "@/lib/informes/tipos";

export interface ConfigApisCliente {
  gscProperty: string | null;
  ga4PropertyId: string | null;
  /** Propiedad GA4 de la landing de Google Ads, distinta de `ga4PropertyId` (sitio principal) — las campañas no apuntan al sitio del cliente. */
  googleAdsGa4PropertyId: string | null;
  metaAdAccountId: string | null;
  metaTokenKey: string | null;
}

export function limitesMes(mes: number, anio: number): { inicio: string; fin: string } {
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { inicio: `${anio}-${String(mes).padStart(2, "0")}-01`, fin: `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}` };
}

export function limitesMesAnterior(mes: number, anio: number): { inicio: string; fin: string } {
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anioAnterior = mes === 1 ? anio - 1 : anio;
  return limitesMes(mesAnterior, anioAnterior);
}

/**
 * `favorable` se deriva del catálogo de métricas conocidas
 * (`lib/informes/metricas-catalogo.ts`) buscando por `etiqueta` — no hay que
 * pasar a mano si subir es bueno o malo en cada call site, así una métrica
 * nunca queda mal clasificada por un booleano olvidado (bug real: "CPC"
 * nunca estuvo invertido en la primera versión de este archivo).
 */
function calcularDelta(etiqueta: string, actual: number, anterior: number): { texto: string; direccion: "up" | "down"; favorable: ReturnType<typeof criterioAFavorable> } {
  const criterio = criterioDeMetrica(etiqueta);
  if (!anterior) {
    const direccion = actual >= anterior ? "up" : "down";
    return { texto: actual ? "nuevo" : "0%", direccion, favorable: actual > 0 ? criterioAFavorable(criterio, direccion) : "neutro" };
  }
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const direccion = pct >= 0 ? "up" : "down";
  return { texto: `${Math.abs(Math.round(pct))}%`, direccion, favorable: criterioAFavorable(criterio, direccion) };
}

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`.replace(".", ",");
// Sin Math.round: el costo por resultado suele ser menor a la unidad — ver el
// mismo comentario en lib/data/resultados.ts.
const fmtMoneda = (n: number, moneda: string) => `${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${moneda}`;

/** "Posición media" es más intuitiva como diferencia absoluta que como %, y bajar es mejorar — distinto criterio que `calcularDelta`. */
function deltaPosicion(actual: number, anterior: number): string {
  if (!anterior) return "sin dato del mes anterior";
  const diff = Math.round((anterior - actual) * 10) / 10;
  if (Math.abs(diff) < 0.1) return "estable vs. mes anterior";
  return `${diff > 0 ? "mejoró" : "empeoró"} ${Math.abs(diff)} posiciones vs. mes anterior`;
}

function deltaTextoPct(actual: number, anterior: number): string {
  if (!anterior) return "sin dato del mes anterior";
  // Etiqueta vacía: esta función solo arma texto (signo + magnitud), nunca lee `favorable`.
  const { texto, direccion } = calcularDelta("", actual, anterior);
  return `${direccion === "up" ? "+" : "-"}${texto} vs. mes anterior`;
}

/**
 * Pre-llena "Punto de partida" y "Tráfico desde IA" desde GSC/GA4 reales
 * (§3.14) — mejor esfuerzo: si el cliente no tiene las propiedades
 * configuradas, o la API falla y no hay snapshot previo, deja esas
 * secciones tal como venían (vacías o del informe duplicado). Cada métrica
 * de "Punto de partida" trae también su comparación contra el mes
 * anterior en `descripcion` — pedido explícito del usuario: los números
 * sueltos, sin contexto de hacia dónde van, no dicen nada en un informe de
 * cliente. Ese mismo texto lo lee después la generación narrativa con IA
 * (`generarNarrativaSeo`), así el insight también queda anclado al cambio
 * real, no solo a la foto del mes.
 */
export async function prellenarSeoDesdeApis(
  clientId: string,
  serviceId: string | null,
  config: ConfigApisCliente,
  periodoMes: number,
  periodoAnio: number,
): Promise<Partial<InformeSeoContenido>> {
  const { inicio, fin } = limitesMes(periodoMes, periodoAnio);
  const { inicio: inicioAnt, fin: finAnt } = limitesMesAnterior(periodoMes, periodoAnio);
  const resultado: Partial<InformeSeoContenido> = {};

  if (config.gscProperty) {
    try {
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId, fuente: "gsc", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerResumenGSC(config.gscProperty!, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId, fuente: "gsc", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerResumenGSC(config.gscProperty!, inicioAnt, finAnt) }),
      ]);
      resultado.puntoDePartida = {
        metricas: [
          { valor: fmtPct(actual.ctr), etiqueta: "CTR global", descripcion: deltaTextoPct(actual.ctr, anterior.ctr) },
          { valor: actual.posicionMedia.toFixed(1).replace(".", ","), etiqueta: "Posición media", descripcion: deltaPosicion(actual.posicionMedia, anterior.posicionMedia) },
          { valor: fmtNumero(actual.impresiones), etiqueta: "Impresiones", descripcion: deltaTextoPct(actual.impresiones, anterior.impresiones) },
          { valor: fmtNumero(actual.clics), etiqueta: "Clics", descripcion: deltaTextoPct(actual.clics, anterior.clics) },
        ],
      };
    } catch {
      // sin GSC configurado o sin snapshot previo — queda sin pre-llenar
    }
  }

  if (config.ga4PropertyId) {
    try {
      const { datos } = await conCacheDeSnapshot({
        clientId,
        serviceId,
        fuente: "ga4",
        periodoInicio: inicio,
        periodoFin: fin,
        fetchLive: () => obtenerTraficoIAGA4(config.ga4PropertyId!, inicio, fin),
      });
      if (datos.totalSesiones > 0) {
        resultado.traficoIA = {
          totalSesiones: String(datos.totalSesiones),
          filas: datos.filas.map((f) => ({ fuente: f.fuente, sesiones: String(f.sesiones), usuarios: String(f.usuarios), conversiones: String(f.conversiones) })),
        };
      }
    } catch {
      // sin GA4 configurado, sin tráfico de IA en el período, o sin snapshot previo
    }
  }

  return resultado;
}

interface ResultadoPrellenadoAds {
  metricas: InformeMarketingContenido["comoVamosCifras"]["metricas"];
  gastoReal: { valor: number; moneda: string } | null;
}

/**
 * Mismas cinco métricas, mismo orden y mismas fórmulas que `seccionMeta`
 * en `lib/data/resultados.ts` (pestaña Resultados) — pedido explícito del
 * usuario: "las metricas debieran venir directamente como en la sección
 * resultados y debieran ser las mismas métricas". No se comparte el
 * helper entre ambos módulos (convención ya establecida del proyecto),
 * pero el conjunto/orden/fórmula se mantiene idéntico a propósito. CPC no
 * se muestra acá porque tampoco se muestra en Resultados.
 */
function metricasDesdeMeta(actual: ResumenInsightsMeta, anterior: ResumenInsightsMeta): InformeMarketingContenido["comoVamosCifras"]["metricas"] {
  const costoActual = actual.resultados > 0 ? actual.gasto / actual.resultados : 0;
  const costoAnterior = anterior.resultados > 0 ? anterior.gasto / anterior.resultados : 0;
  const d = (etiqueta: string, a: number, b: number) => {
    const { texto, direccion, favorable } = calcularDelta(etiqueta, a, b);
    return { deltaTexto: texto, deltaDireccion: direccion, favorable };
  };
  return [
    { etiqueta: "Inversión", valor: fmtMoneda(actual.gasto, "USD"), ...d("Inversión", actual.gasto, anterior.gasto) },
    { etiqueta: "Resultados", valor: fmtNumero(actual.resultados), ...d("Resultados", actual.resultados, anterior.resultados) },
    { etiqueta: "Costo por resultado", valor: fmtMoneda(costoActual, "USD"), ...d("Costo por resultado", costoActual, costoAnterior) },
    { etiqueta: "CTR", valor: `${actual.ctr.toFixed(2)}%`, ...d("CTR", actual.ctr, anterior.ctr) },
    { etiqueta: "Alcance", valor: fmtNumero(actual.alcance), ...d("Alcance", actual.alcance, anterior.alcance) },
  ];
}

/**
 * Mismas cuatro métricas, mismo orden y mismas fórmulas que
 * `seccionGoogleAds` en `lib/data/resultados.ts` — mismo pedido del
 * usuario que `metricasDesdeMeta` más arriba. El costo total (gasto)
 * sigue sin mostrarse como fila propia, igual que en Resultados; sigue
 * disponible como `gastoReal`/`actual.costo` para el pacing automático de
 * "Inversión del mes". Extraída a su propia función (antes vivía inline
 * en `prellenarAdsDesdeApis`) para poder reusarla también desde
 * `prellenarAdsCombinadoDesdeApis` sin duplicar las fórmulas.
 */
function metricasDesdeGoogleAds(actual: ResumenTraficoPagado, anterior: ResumenTraficoPagado): InformeMarketingContenido["comoVamosCifras"]["metricas"] {
  // Derivadas de lo mismo ya traído (sesiones/conversiones/costo) — antes el
  // equipo las agregaba a mano fila por fila, lo que dejaba "Costo por
  // conversión"/"Tasa de conversión" sin `favorable` real (bug reportado:
  // quedaban en rojo por defecto, mismo motivo que "Costo por resultado"
  // de Meta más arriba).
  const costoPorConvActual = actual.conversiones > 0 ? actual.costo / actual.conversiones : 0;
  const costoPorConvAnterior = anterior.conversiones > 0 ? anterior.costo / anterior.conversiones : 0;
  const tasaConvActual = actual.sesiones > 0 ? actual.conversiones / actual.sesiones : 0;
  const tasaConvAnterior = anterior.sesiones > 0 ? anterior.conversiones / anterior.sesiones : 0;
  const d = (etiqueta: string, a: number, b: number) => {
    const { texto, direccion, favorable } = calcularDelta(etiqueta, a, b);
    return { deltaTexto: texto, deltaDireccion: direccion, favorable };
  };
  return [
    { etiqueta: "Sesiones pagas", valor: fmtNumero(actual.sesiones), ...d("Sesiones pagas", actual.sesiones, anterior.sesiones) },
    { etiqueta: "Conversiones", valor: fmtNumero(actual.conversiones), ...d("Conversiones", actual.conversiones, anterior.conversiones) },
    { etiqueta: "Tasa de conversión", valor: fmtPct(tasaConvActual), ...d("Tasa de conversión", tasaConvActual, tasaConvAnterior) },
    { etiqueta: "Costo por conversión", valor: fmtMoneda(costoPorConvActual, "CLP"), ...d("Costo por conversión", costoPorConvActual, costoPorConvAnterior) },
  ];
}

/**
 * Pre-llena "¿Cómo vamos?" del informe de Ads con datos reales — Meta
 * Insights para `meta_ads`; GA4 con filtro `sessionMedium=cpc/paid` para
 * `google_ads`, ya que no hay una API de Google Ads propia conectada
 * todavía (§3.14). También devuelve el gasto real del mes para
 * reemplazar el ingreso manual del pacing (§3.9 → automático).
 */
export async function prellenarAdsDesdeApis(
  clientId: string,
  serviceId: string,
  servicioTipo: "meta_ads" | "google_ads",
  config: ConfigApisCliente,
  periodoMes: number,
  periodoAnio: number,
): Promise<ResultadoPrellenadoAds> {
  const { inicio, fin } = limitesMes(periodoMes, periodoAnio);
  const { inicio: inicioAnt, fin: finAnt } = limitesMesAnterior(periodoMes, periodoAnio);

  if (servicioTipo === "meta_ads" && config.metaAdAccountId) {
    try {
      const metaConfig = { adAccountId: config.metaAdAccountId, metaTokenKey: config.metaTokenKey };
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId, fuente: "meta", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerResumenMeta(metaConfig, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId, fuente: "meta", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerResumenMeta(metaConfig, inicioAnt, finAnt) }),
      ]);
      return { metricas: metricasDesdeMeta(actual, anterior), gastoReal: { valor: actual.gasto, moneda: "USD" } };
    } catch {
      return { metricas: [], gastoReal: null };
    }
  }

  if (servicioTipo === "google_ads" && config.googleAdsGa4PropertyId) {
    try {
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId, fuente: "ga4", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerTraficoPagadoGA4(config.googleAdsGa4PropertyId!, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId, fuente: "ga4", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerTraficoPagadoGA4(config.googleAdsGa4PropertyId!, inicioAnt, finAnt) }),
      ]);
      return { metricas: metricasDesdeGoogleAds(actual, anterior), gastoReal: { valor: actual.costo, moneda: "CLP" } };
    } catch {
      return { metricas: [], gastoReal: null };
    }
  }

  return { metricas: [], gastoReal: null };
}

interface ResultadoPrellenadoAdsCombinado {
  meta: ResultadoPrellenadoAds | null;
  google: ResultadoPrellenadoAds | null;
  comparacionCanales: InformeAdsCombinadoContenido["comparacionCanales"];
}

/**
 * Compara los dos canales por lo único que es seguro comparar sin
 * fabricar una equivalencia: el volumen de resultados/conversiones (un
 * conteo, no depende de moneda) y, por separado, cuánto invirtió cada uno
 * en su propia moneda. Nunca declara "más barato" cruzando monedas
 * (Meta en USD, Google en CLP en esta plataforma) sin una tasa de cambio
 * real — mismo criterio del proyecto de no inventar comparaciones que no
 * se pueden sostener con el dato real (mismo espíritu que la nota de
 * "Google Ads vía GA4" ya documentada en CLAUDE.md).
 */
function compararCanalesAds(
  meta: { resultados: number; gasto: { valor: number; moneda: string } } | null,
  google: { conversiones: number; gasto: { valor: number; moneda: string } } | null,
): InformeAdsCombinadoContenido["comparacionCanales"] {
  if (!meta || !google) return { filas: [], insight: "" };

  const filas = [
    { etiqueta: "Resultados de negocio", meta: fmtNumero(meta.resultados), google: fmtNumero(google.conversiones) },
    { etiqueta: "Inversión", meta: fmtMoneda(meta.gasto.valor, meta.gasto.moneda), google: fmtMoneda(google.gasto.valor, google.gasto.moneda) },
  ];

  const avisoMoneda =
    meta.gasto.moneda !== google.gasto.moneda
      ? ` El costo de cada canal está en monedas distintas (${meta.gasto.moneda} vs. ${google.gasto.moneda}) — compara el costo por resultado de cada uno en su propia moneda antes de decidir dónde priorizar presupuesto.`
      : "";
  const insight =
    meta.resultados === google.conversiones
      ? `Meta Ads y Google Ads generaron un volumen de resultados similar este mes (${fmtNumero(meta.resultados)}).${avisoMoneda}`
      : meta.resultados > google.conversiones
        ? `Meta Ads generó más resultados este mes (${fmtNumero(meta.resultados)} vs. ${fmtNumero(google.conversiones)} de Google Ads).${avisoMoneda}`
        : `Google Ads generó más resultados este mes (${fmtNumero(google.conversiones)} vs. ${fmtNumero(meta.resultados)} de Meta Ads).${avisoMoneda}`;

  return { filas, insight };
}

/**
 * Pre-llena "¿Cómo vamos?" del informe combinado — misma fuente de datos
 * que `prellenarAdsDesdeApis` (una llamada por canal, cacheada bajo el
 * `service_id` real de cada uno, así que no colisiona con el snapshot de
 * un eventual informe de un solo canal para el mismo servicio/período),
 * más la comparación entre canales (§3.4, "para poder comparar los
 * resultados e ir viendo cual rinde mejor").
 */
export async function prellenarAdsCombinadoDesdeApis(
  clientId: string,
  metaServiceId: string | null,
  googleServiceId: string | null,
  config: ConfigApisCliente,
  periodoMes: number,
  periodoAnio: number,
): Promise<ResultadoPrellenadoAdsCombinado> {
  const { inicio, fin } = limitesMes(periodoMes, periodoAnio);
  const { inicio: inicioAnt, fin: finAnt } = limitesMesAnterior(periodoMes, periodoAnio);

  let meta: (ResultadoPrellenadoAds & { resultados: number }) | null = null;
  if (metaServiceId && config.metaAdAccountId) {
    try {
      const metaConfig = { adAccountId: config.metaAdAccountId, metaTokenKey: config.metaTokenKey };
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId: metaServiceId, fuente: "meta", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerResumenMeta(metaConfig, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId: metaServiceId, fuente: "meta", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerResumenMeta(metaConfig, inicioAnt, finAnt) }),
      ]);
      meta = { metricas: metricasDesdeMeta(actual, anterior), gastoReal: { valor: actual.gasto, moneda: "USD" }, resultados: actual.resultados };
    } catch {
      // sin Meta configurado, API caída y sin snapshot previo — esa mitad queda sin pre-llenar
    }
  }

  let google: (ResultadoPrellenadoAds & { conversiones: number }) | null = null;
  if (googleServiceId && config.googleAdsGa4PropertyId) {
    try {
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId: googleServiceId, fuente: "ga4", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerTraficoPagadoGA4(config.googleAdsGa4PropertyId!, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId: googleServiceId, fuente: "ga4", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerTraficoPagadoGA4(config.googleAdsGa4PropertyId!, inicioAnt, finAnt) }),
      ]);
      google = { metricas: metricasDesdeGoogleAds(actual, anterior), gastoReal: { valor: actual.costo, moneda: "CLP" }, conversiones: actual.conversiones };
    } catch {
      // sin GA4 de la landing configurado, API caída y sin snapshot previo — esa mitad queda sin pre-llenar
    }
  }

  return {
    meta,
    google,
    comparacionCanales: compararCanalesAds(
      meta && { resultados: meta.resultados, gasto: meta.gastoReal! },
      google && { conversiones: google.conversiones, gasto: google.gastoReal! },
    ),
  };
}
