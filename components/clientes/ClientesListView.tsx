import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { AjusteDrawer } from "./AjusteDrawer";
import { NuevoClienteDrawer } from "./NuevoClienteDrawer";
import { SERVICE_LABEL, type AjusteReciente, type ClienteResumen, type ServicioActivoOpcion } from "@/lib/data/clients";
import type { UsuarioResumen } from "@/lib/data/users";
import { fmtFecha } from "@/lib/dates";

const CHIP_COLOR: Record<string, { fg: string; bg: string }> = {
  seo_aeo_geo: { fg: "#6d5bd6", bg: "#efecfb" },
  meta_ads: { fg: "#2563eb", bg: "#e8f0fe" },
  google_ads: { fg: "#0d9488", bg: "#e3f4f2" },
};

const ESTADO_CLIENTE: Record<ClienteResumen["estado"], { label: string; fg: string; bg: string }> = {
  activo: { label: "Activo", fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  pausado: { label: "Pausado", fg: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  finalizado: { label: "Finalizado", fg: "var(--color-muted-2)", bg: "var(--color-border-soft)" },
};

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

        <div className="grid gap-5 px-[26px] pb-10 pt-[22px]" style={{ gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)" }}>
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            {clientes.map((c) => {
              const estado = ESTADO_CLIENTE[c.estado];
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="crow flex items-center gap-3 border-b border-border-soft-2 px-5 py-3.5 last:border-b-0"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
                    {c.nombre.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{c.nombre}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.servicios.map((s, i) => {
                        const color = CHIP_COLOR[s.tipo] ?? { fg: "var(--color-muted)", bg: "var(--color-border-soft)" };
                        return (
                          <span
                            key={i}
                            className="rounded-full px-2 py-px text-[10.5px] font-semibold"
                            style={{ color: color.fg, background: color.bg }}
                          >
                            {SERVICE_LABEL[s.tipo] ?? s.tipo}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="w-[140px] flex-none text-[12px] text-muted">
                    {c.responsables.join(" · ") || "Sin asignar"}
                  </div>
                  <span
                    className="w-[92px] flex-none rounded-full px-2 py-0.5 text-center text-[10.5px] font-semibold"
                    style={{ color: estado.fg, background: estado.bg }}
                  >
                    {estado.label}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-[14px] border border-border bg-surface p-5">
              <div className="mb-3 text-[13px] font-bold uppercase text-faint [letter-spacing:.03em]">
                Ajustes de servicios
              </div>
              <AjusteDrawer servicios={servicios} clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
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
