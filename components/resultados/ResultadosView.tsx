import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { SelectorResultados } from "./SelectorResultados";
import { KpiFila } from "./KpiFila";
import { SerieTiempo } from "./SerieTiempo";
import { BarrasCategoria } from "./BarrasCategoria";
import { InsightCallout } from "./InsightCallout";
import { Funnel } from "./Funnel";
import { DistribucionPosiciones } from "./DistribucionPosiciones";
import { TablaCampanas } from "./TablaCampanas";
import { TablaKeywords } from "./TablaKeywords";
import { TablaPaginasIA } from "./TablaPaginasIA";
import { fmtFecha } from "@/lib/dates";
import { fmtDeltaPct } from "@/lib/resultados-formato";
import type { ClienteSelectorResultados, ResultadosCliente } from "@/lib/data/resultados";

const COLOR_SEO = "var(--color-svc-seo)";
const COLOR_GOOGLE = "var(--color-svc-google)";
const COLOR_META = "#2563eb";

const fmtNum = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

function Panel({
  titulo,
  etiqueta,
  color,
  disponible,
  motivo,
  deCache,
  children,
}: {
  titulo: string;
  etiqueta: string;
  color: string;
  disponible: boolean;
  motivo?: string;
  deCache?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} />
        <h2 className="text-[15px] font-bold text-ink">{titulo}</h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2">{etiqueta}</span>
      </div>
      {!disponible ? (
        <p className="text-[12.5px] text-muted-2">{motivo}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {children}
          {deCache && <p className="text-[11px] text-warning">⚠ {deCache}</p>}
        </div>
      )}
    </section>
  );
}

export function ResultadosView({
  usuario,
  clientes,
  data,
}: {
  usuario: SidebarUsuario;
  clientes: ClienteSelectorResultados[];
  data: ResultadosCliente;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="resultados" usuario={usuario} />
      <main className="flex-1 px-8 py-7">
        <div className="mx-auto flex max-w-[860px] flex-col gap-5">
          <div>
            <h1 className="text-[20px] font-bold text-ink">Resultados</h1>
            <p className="mt-1 text-[13px] text-muted">
              {data.clienteNombre} · {fmtFecha(data.rangoFechas.desde)} — {fmtFecha(data.rangoFechas.hasta)}
            </p>
          </div>

          <SelectorResultados clientes={clientes} clienteId={data.clienteId} rango={data.rango} />

          <Panel titulo="SEO · AEO · GEO" etiqueta="Search Console" color={COLOR_SEO} disponible={data.seo.disponible} motivo={data.seo.motivo} deCache={data.seo.deCache}>
            <InsightCallout texto={data.seo.insight} />
            <KpiFila kpis={data.seo.kpis} />
            {data.seo.funnel && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Impresiones → clics → conversión</div>
                <Funnel funnel={data.seo.funnel} />
              </div>
            )}
            <div className="flex flex-wrap gap-6">
              <div className="min-w-[280px] flex-1">
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Clics por día</div>
                <SerieTiempo serie={data.seo.serie} hitos={data.seo.hitos} color={COLOR_SEO} formato="numero" />
              </div>
              {data.seo.distribucionPosiciones && (
                <div>
                  <div className="mb-2 text-[11.5px] font-semibold text-muted">Distribución de posiciones</div>
                  <DistribucionPosiciones datos={data.seo.distribucionPosiciones} />
                </div>
              )}
            </div>
            {data.seo.keywords.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Top keywords</div>
                <TablaKeywords filas={data.seo.keywords} />
              </div>
            )}
            {data.seo.gscHasta && (
              <p className="text-[10.5px] leading-relaxed text-muted-2">
                Datos de Search Console hasta el {fmtFecha(data.seo.gscHasta)}: la API tarda 2-3 días en procesar, así que los últimos días del
                período todavía no están disponibles — es normal que estos números no coincidan exactamente con lo que se ve en Search Console si
                se mira un rango que termine hoy.
              </p>
            )}
          </Panel>

          <Panel titulo="AEO · GEO — Tráfico desde IA" etiqueta="GA4" color="#eda100" disponible={data.aeo.disponible} motivo={data.aeo.motivo} deCache={data.aeo.deCache}>
            <InsightCallout texto={data.aeo.insight} />
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-ink">{fmtNum(data.aeo.totalSesiones)}</span>
                <span className="text-[12px] text-muted-2">sesiones desde fuentes de IA</span>
                {data.aeo.deltaSesiones && (
                  <span
                    className="text-[11.5px] font-semibold"
                    style={{
                      color:
                        data.aeo.deltaSesiones.tendencia === "flat"
                          ? "var(--color-muted-2)"
                          : data.aeo.deltaSesiones.favorable
                            ? "var(--color-success)"
                            : "var(--color-danger)",
                    }}
                  >
                    {data.aeo.deltaSesiones.pct === null ? "nuevo" : fmtDeltaPct(data.aeo.deltaSesiones.pct)}
                  </span>
                )}
              </div>
              {data.aeo.tasaConversion !== null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[15px] font-bold text-ink">{fmtPct(data.aeo.tasaConversion)}</span>
                  <span className="text-[12px] text-muted-2">tasa de conversión IA</span>
                </div>
              )}
            </div>
            <BarrasCategoria filas={data.aeo.porFuente} formato={fmtNum} />
            {data.aeo.paginasDestino.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Páginas de aterrizaje desde IA</div>
                <TablaPaginasIA filas={data.aeo.paginasDestino} />
              </div>
            )}
            <p className="text-[10.5px] leading-relaxed text-muted-2">
              El tráfico desde IA se subestima: varias plataformas no envían Referer y caen como “directo”, y los AI Overviews de Google no son
              filtrables por separado en la API de Search Console (§3.14/§4.3).
            </p>
          </Panel>

          <Panel titulo="Meta Ads" etiqueta="Meta Insights" color={COLOR_META} disponible={data.meta.disponible} motivo={data.meta.motivo} deCache={data.meta.deCache}>
            <InsightCallout texto={data.meta.insight} />
            <KpiFila kpis={data.meta.kpis} />
            <div>
              <div className="mb-2 text-[11.5px] font-semibold text-muted">Inversión por día</div>
              <SerieTiempo serie={data.meta.serie} hitos={data.meta.hitos} color={COLOR_META} formato="moneda" />
            </div>
            {data.meta.campanas.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Resultados por campaña</div>
                <TablaCampanas filas={data.meta.campanas} etiquetaInteracciones="Clics" moneda="USD" />
              </div>
            )}
          </Panel>

          <Panel titulo="Google Ads" etiqueta="GA4 · tráfico pagado" color={COLOR_GOOGLE} disponible={data.googleAds.disponible} motivo={data.googleAds.motivo} deCache={data.googleAds.deCache}>
            <InsightCallout texto={data.googleAds.insight} />
            <KpiFila kpis={data.googleAds.kpis} />
            <div>
              <div className="mb-2 text-[11.5px] font-semibold text-muted">Sesiones pagas por día</div>
              <SerieTiempo serie={data.googleAds.serie} hitos={data.googleAds.hitos} color={COLOR_GOOGLE} formato="numero" />
            </div>
            {data.googleAds.campanas.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Resultados por campaña</div>
                <TablaCampanas filas={data.googleAds.campanas} etiquetaInteracciones="Sesiones" moneda="CLP" />
              </div>
            )}
            {data.googleAds.disponible && (
              <p className="text-[10.5px] leading-relaxed text-muted-2">
                Estas cifras vienen de GA4 (sesiones con <code>sessionMedium = cpc/paid</code>), no de una conexión directa a Google Ads — todavía
                no existe esa integración (§3.14). Las conversiones y el costo pueden no coincidir con lo que reporta Google Ads directamente: Ads
                usa su propio seguimiento de conversiones (con modelado y atribución entre dispositivos) que GA4 no replica. Para el número
                oficial de conversiones y costo, revisar Google Ads directamente.
              </p>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
