import { conCacheDeSnapshot } from "@/lib/metricas/snapshot";
import { obtenerResumenGSC } from "@/lib/google/gsc";
import { obtenerTraficoIAGA4, obtenerTraficoPagadoGA4 } from "@/lib/google/ga4";
import { obtenerResumenMeta, type ResumenInsightsMeta } from "@/lib/meta/client";
import type { InformeMarketingContenido, InformeSeoContenido } from "@/lib/informes/tipos";

export interface ConfigApisCliente {
  gscProperty: string | null;
  ga4PropertyId: string | null;
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

function calcularDelta(actual: number, anterior: number): { texto: string; direccion: "up" | "down" } {
  if (!anterior) return { texto: actual ? "nuevo" : "0%", direccion: actual >= anterior ? "up" : "down" };
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  return { texto: `${Math.abs(Math.round(pct))}%`, direccion: pct >= 0 ? "up" : "down" };
}

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`.replace(".", ",");
const fmtMoneda = (n: number, moneda: string) => `${Math.round(n).toLocaleString("es-CL")} ${moneda}`;

/**
 * Pre-llena "Punto de partida" y "Tráfico desde IA" desde GSC/GA4 reales
 * (§3.14) — mejor esfuerzo: si el cliente no tiene las propiedades
 * configuradas, o la API falla y no hay snapshot previo, deja esas
 * secciones tal como venían (vacías o del informe duplicado).
 */
export async function prellenarSeoDesdeApis(
  clientId: string,
  serviceId: string | null,
  config: ConfigApisCliente,
  periodoMes: number,
  periodoAnio: number,
): Promise<Partial<InformeSeoContenido>> {
  const { inicio, fin } = limitesMes(periodoMes, periodoAnio);
  const resultado: Partial<InformeSeoContenido> = {};

  if (config.gscProperty) {
    try {
      const { datos } = await conCacheDeSnapshot({
        clientId,
        serviceId,
        fuente: "gsc",
        periodoInicio: inicio,
        periodoFin: fin,
        fetchLive: () => obtenerResumenGSC(config.gscProperty!, inicio, fin),
      });
      resultado.puntoDePartida = {
        metricas: [
          { valor: fmtPct(datos.ctr), etiqueta: "CTR global", descripcion: "" },
          { valor: datos.posicionMedia.toFixed(1).replace(".", ","), etiqueta: "Posición media", descripcion: "" },
          { valor: fmtNumero(datos.impresiones), etiqueta: "Impresiones", descripcion: "" },
          { valor: fmtNumero(datos.clics), etiqueta: "Clics", descripcion: "" },
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

function metricasDesdeMeta(actual: ResumenInsightsMeta, anterior: ResumenInsightsMeta): InformeMarketingContenido["comoVamosCifras"]["metricas"] {
  const costoActual = actual.resultados > 0 ? actual.gasto / actual.resultados : 0;
  const costoAnterior = anterior.resultados > 0 ? anterior.gasto / anterior.resultados : 0;
  const d = (a: number, b: number) => {
    const { texto, direccion } = calcularDelta(a, b);
    return { deltaTexto: texto, deltaDireccion: direccion };
  };
  return [
    { etiqueta: "Inversión", valor: fmtMoneda(actual.gasto, "USD"), ...d(actual.gasto, anterior.gasto) },
    { etiqueta: "Resultados", valor: fmtNumero(actual.resultados), ...d(actual.resultados, anterior.resultados) },
    { etiqueta: "Costo por resultado", valor: fmtMoneda(costoActual, "USD"), ...d(costoActual, costoAnterior) },
    { etiqueta: "CTR", valor: `${actual.ctr.toFixed(2)}%`, ...d(actual.ctr, anterior.ctr) },
    { etiqueta: "CPC", valor: fmtMoneda(actual.cpc, "USD"), ...d(actual.cpc, anterior.cpc) },
    { etiqueta: "Alcance", valor: fmtNumero(actual.alcance), ...d(actual.alcance, anterior.alcance) },
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

  if (servicioTipo === "google_ads" && config.ga4PropertyId) {
    try {
      const [{ datos: actual }, { datos: anterior }] = await Promise.all([
        conCacheDeSnapshot({ clientId, serviceId, fuente: "ga4", periodoInicio: inicio, periodoFin: fin, fetchLive: () => obtenerTraficoPagadoGA4(config.ga4PropertyId!, inicio, fin) }),
        conCacheDeSnapshot({ clientId, serviceId, fuente: "ga4", periodoInicio: inicioAnt, periodoFin: finAnt, fetchLive: () => obtenerTraficoPagadoGA4(config.ga4PropertyId!, inicioAnt, finAnt) }),
      ]);
      const d = (a: number, b: number) => {
        const { texto, direccion } = calcularDelta(a, b);
        return { deltaTexto: texto, deltaDireccion: direccion };
      };
      return {
        metricas: [
          { etiqueta: "Sesiones pagas", valor: fmtNumero(actual.sesiones), ...d(actual.sesiones, anterior.sesiones) },
          { etiqueta: "Conversiones", valor: fmtNumero(actual.conversiones), ...d(actual.conversiones, anterior.conversiones) },
          { etiqueta: "Costo", valor: fmtMoneda(actual.costo, "CLP"), ...d(actual.costo, anterior.costo) },
        ],
        gastoReal: { valor: actual.costo, moneda: "CLP" },
      };
    } catch {
      return { metricas: [], gastoReal: null };
    }
  }

  return { metricas: [], gastoReal: null };
}
