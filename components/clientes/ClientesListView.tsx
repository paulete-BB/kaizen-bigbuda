import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { AjusteDrawer } from "./AjusteDrawer";
import { NuevoClienteDrawer } from "./NuevoClienteDrawer";
import {
  type AjusteReciente,
  type ClienteResumen,
  type KpiDiaCliente,
  type ServicioActivoOpcion,
  type ServicioResumenLista,
} from "@/lib/data/clients";
import type { UsuarioResumen } from "@/lib/data/users";
import { fmtFecha } from "@/lib/dates";

const ESTADO_CLIENTE: Record<ClienteResumen["estado"], { label: string; fg: string; bg: string }> = {
  activo: { label: "Activo", fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  pausado: { label: "Pausado", fg: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  finalizado: { label: "Finalizado", fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

// Solo se pinta cuando hay algo que avisar — "activo" no necesita insignia
// propia acá (ya se ve en que la columna del servicio tiene contenido), mismo
// criterio de "nunca pintar todo, solo las excepciones" que ya usa
// AlertasPanel en el Dashboard.
const VIGENCIA_BADGE: Record<string, { label: string; fg: string; bg: string } | undefined> = {
  por_vencer: { label: "Por vencer", fg: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  vencido: { label: "Vencido", fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  pausado: { label: "Pausado", fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

const fmtNumero = (n: number) => Math.round(n).toLocaleString("es-CL");

function servicioDe(cliente: ClienteResumen, tipo: string): ServicioResumenLista | undefined {
  return cliente.servicios.find((s) => s.tipo === tipo);
}

/**
 * Una celda de servicio: nombre + badge de vigencia (solo si hay excepción) +
 * "Atrasada" si corresponde + fecha del último informe + el/los número(s) del
 * día. `null` (servicio no contratado) se pinta como un guion apagado, sin
 * badges — no hay nada que alertar sobre un servicio que el cliente no tiene.
 */
function CeldaServicio({
  servicio,
  kpis,
}: {
  servicio: ServicioResumenLista | undefined;
  kpis: { etiqueta: string; dato: KpiDiaCliente | null }[];
}) {
  if (!servicio) return <span className="text-[12px] text-faint">—</span>;
  const badge = VIGENCIA_BADGE[servicio.estado];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {badge && (
          <span className="rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ color: badge.fg, background: badge.bg }}>
            {badge.label}
          </span>
        )}
        {servicio.atrasada && (
          <span
            className="rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={{ color: "var(--color-danger)", background: "var(--color-danger-bg)" }}
          >
            Atrasada
          </span>
        )}
        {servicio.pacing && (
          <span
            className="rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={{
              color: servicio.pacing.estado === "sobregasto" ? "var(--color-danger)" : "var(--color-warning)",
              background: servicio.pacing.estado === "sobregasto" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
            }}
          >
            {servicio.pacing.estado === "sobregasto" ? "Sobregasto" : "Subgasto"} {Math.round(servicio.pacing.pct)}%
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted [font-variant-numeric:tabular-nums]">
        {kpis.map((k) =>
          k.dato ? (
            <span key={k.etiqueta}>
              {k.etiqueta} <span className="font-semibold text-ink">{fmtNumero(k.dato.valor)}</span>
            </span>
          ) : null,
        )}
      </div>
      <div className="text-[11px] text-muted-2">
        {servicio.ultimoInformeEnviado ? `Informe ${fmtFecha(servicio.ultimoInformeEnviado)}` : "Sin informes enviados"}
      </div>
    </div>
  );
}

export function ClientesListView({
  usuario,
  clientes,
  servicios,
  ajustesRecientes,
  responsables,
}: {
  usuario: SidebarUsuario;
  clientes: ClienteResumen[];
  servicios: ServicioActivoOpcion[];
  ajustesRecientes: AjusteReciente[];
  responsables: UsuarioResumen[];
}) {
  const conPosicionamiento = clientes.filter((c) => c.servicios.some((s) => s.tipo === "seo_aeo_geo")).length;
  const conAds = clientes.filter((c) => c.servicios.some((s) => s.tipo !== "seo_aeo_geo")).length;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-[26px]">
          <div>
            <div className="text-[14px] font-bold">Clientes</div>
            <div className="text-[11.5px] text-muted-2">
              {clientes.length} clientes · {conPosicionamiento} con posicionamiento · {conAds} con ads
            </div>
          </div>
          <div className="flex-1" />
          <NuevoClienteDrawer responsables={responsables} />
        </header>

        <div className="grid gap-5 px-[26px] pb-10 pt-[22px]" style={{ gridTemplateColumns: "minmax(0,2.3fr) minmax(0,1fr)" }}>
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
                    <th className="px-5 py-2.5 font-semibold">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold">Posicionamiento (SEO · AEO)</th>
                    <th className="px-3 py-2.5 font-semibold">Meta Ads</th>
                    <th className="px-3 py-2.5 font-semibold">Google Ads</th>
                    <th className="px-3 py-2.5 font-semibold">Próx. optimización</th>
                    <th className="px-3 py-2.5 font-semibold">Alertas</th>
                    <th className="px-3 py-2.5 font-semibold">Estado</th>
                    <th className="w-8 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => {
                    const estado = ESTADO_CLIENTE[c.estado];
                    const seo = servicioDe(c, "seo_aeo_geo");
                    const meta = servicioDe(c, "meta_ads");
                    const google = servicioDe(c, "google_ads");
                    return (
                      <tr key={c.id} className="border-b border-border-soft-2 align-top last:border-b-0 hover:bg-canvas">
                        <td className="px-5 py-3.5">
                          <Link href={`/clientes/${c.id}`} className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white">
                              {c.nombre.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-ink">{c.nombre}</div>
                              <div className="text-[11px] text-muted-2">{c.responsables.join(" · ") || "Sin asignar"}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3.5">
                          <CeldaServicio
                            servicio={seo}
                            kpis={[
                              { etiqueta: "Clics", dato: c.seoClicksDia },
                              { etiqueta: "IA", dato: c.aeoSesionesIADia },
                            ]}
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <CeldaServicio servicio={meta} kpis={[{ etiqueta: "Conv.", dato: c.metaConversionesDia }]} />
                        </td>
                        <td className="px-3 py-3.5">
                          <CeldaServicio servicio={google} kpis={[{ etiqueta: "Conv.", dato: c.googleConversionesDia }]} />
                        </td>
                        <td className="px-3 py-3.5 text-[12px] text-muted">
                          {c.proximaOptimizacion ? fmtFecha(c.proximaOptimizacion) : <span className="text-faint">—</span>}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col gap-1">
                            {c.onboardingPct !== null && (
                              <span
                                className="w-fit rounded-full px-1.5 py-px text-[10px] font-semibold"
                                style={{ color: "var(--color-warning)", background: "var(--color-warning-bg)" }}
                              >
                                Onboarding {c.onboardingPct}%
                              </span>
                            )}
                            {c.aprobacionesSinRespuesta > 0 && (
                              <span
                                className="w-fit rounded-full px-1.5 py-px text-[10px] font-semibold"
                                style={{ color: "var(--color-danger)", background: "var(--color-danger-bg)" }}
                              >
                                {c.aprobacionesSinRespuesta} aprob. sin respuesta
                              </span>
                            )}
                            {c.onboardingPct === null && c.aprobacionesSinRespuesta === 0 && (
                              <span className="text-[12px] text-faint">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ color: estado.fg, background: estado.bg }}
                          >
                            {estado.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <Link href={`/clientes/${c.id}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" strokeWidth="2">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-[14px] border border-border bg-surface p-5">
              <div className="mb-3 text-[13px] font-bold uppercase text-faint [letter-spacing:.03em]">
                Ajustes de servicios
              </div>
              <AjusteDrawer
                servicios={servicios}
                clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, serviciosTipos: c.servicios.map((s) => s.tipo) }))}
              />
            </div>

            <div className="rounded-[14px] border border-border bg-surface p-5">
              <div className="mb-3 text-[13px] font-bold uppercase text-faint [letter-spacing:.03em]">
                Ajustes recientes
              </div>
              {ajustesRecientes.length === 0 ? (
                <p className="text-[12px] text-muted-2">Todavía no hay ajustes registrados.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {ajustesRecientes.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: a.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-ink">{a.descripcion}</div>
                        <div className="text-[11px] text-muted-2">
                          {a.autor ? `${a.autor} · ` : ""}
                          {fmtFecha(a.fecha.slice(0, 10))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
