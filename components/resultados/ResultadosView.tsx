import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { SelectorResultados } from "./SelectorResultados";
import { KpiFila } from "./KpiFila";
import { SerieTiempo } from "./SerieTiempo";
import { BarrasHorizontales } from "./BarrasHorizontales";
import { BarrasCategoria } from "./BarrasCategoria";
import { fmtFecha } from "@/lib/dates";
import type { ClienteSelectorResultados, ResultadosCliente } from "@/lib/data/resultados";

const COLOR_SEO = "var(--color-svc-seo)";
const COLOR_GOOGLE = "var(--color-svc-google)";
const COLOR_META = "#2563eb";

const fmtNum = (n: number) => Math.round(n).toLocaleString("es-CL");
const fmtMoneda = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

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
            <KpiFila kpis={data.seo.kpis} />
            <div>
              <div className="mb-2 text-[11.5px] font-semibold text-muted">Clics por día</div>
              <SerieTiempo serie={data.seo.serie} hitos={data.seo.hitos} color={COLOR_SEO} formato="numero" />
            </div>
            {data.seo.keywords.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Top keywords por clics</div>
                <BarrasHorizontales filas={data.seo.keywords.map((k) => ({ etiqueta: k.termino, valor: k.clics }))} color={COLOR_SEO} formato={fmtNum} />
              </div>
            )}
          </Panel>

          <Panel titulo="AEO · GEO — Tráfico desde IA" etiqueta="GA4" color="#eda100" disponible={data.aeo.disponible} motivo={data.aeo.motivo} deCache={data.aeo.deCache}>
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-ink">{fmtNum(data.aeo.totalSesiones)}</span>
              <span className="text-[12px] text-muted-2">sesiones totales desde fuentes de IA</span>
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
                  {data.aeo.deltaSesiones.pct === null ? "nuevo" : `${data.aeo.deltaSesiones.pct > 0 ? "+" : ""}${data.aeo.deltaSesiones.pct}%`}
                </span>
              )}
            </div>
            <BarrasCategoria filas={data.aeo.porFuente} formato={fmtNum} />
            <p className="text-[10.5px] leading-relaxed text-muted-2">
              El tráfico desde IA se subestima: varias plataformas no envían Referer y caen como “directo”, y los AI Overviews de Google no son
              filtrables por separado en la API de Search Console (§3.14/§4.3).
            </p>
          </Panel>

          <Panel titulo="Meta Ads" etiqueta="Meta Insights" color={COLOR_META} disponible={data.meta.disponible} motivo={data.meta.motivo} deCache={data.meta.deCache}>
            <KpiFila kpis={data.meta.kpis} />
            <div>
              <div className="mb-2 text-[11.5px] font-semibold text-muted">Inversión por día</div>
              <SerieTiempo serie={data.meta.serie} hitos={data.meta.hitos} color={COLOR_META} formato="moneda" />
            </div>
            {data.meta.campanas.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-semibold text-muted">Campañas por inversión</div>
                <BarrasHorizontales filas={data.meta.campanas.map((c) => ({ etiqueta: c.nombre, valor: c.gasto }))} color={COLOR_META} formato={fmtMoneda} />
              </div>
            )}
          </Panel>

          <Panel titulo="Google Ads" etiqueta="GA4 · tráfico pagado" color={COLOR_GOOGLE} disponible={data.googleAds.disponible} motivo={data.googleAds.motivo} deCache={data.googleAds.deCache}>
            <KpiFila kpis={data.googleAds.kpis} />
            <div>
              <div className="mb-2 text-[11.5px] font-semibold text-muted">Sesiones pagas por día</div>
              <SerieTiempo serie={data.googleAds.serie} hitos={data.googleAds.hitos} color={COLOR_GOOGLE} formato="numero" />
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
