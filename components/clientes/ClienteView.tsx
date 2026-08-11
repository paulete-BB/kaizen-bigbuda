import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { ClienteHeader } from "./ClienteHeader";
import { ServiciosPanel } from "./ServiciosPanel";
import { TareasPanel } from "./TareasPanel";
import { BitacoraPanel } from "./BitacoraPanel";
import { DescuentosPanel } from "./DescuentosPanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { ReunionesPanel } from "./ReunionesPanel";
import { IntegracionesPanel } from "./IntegracionesPanel";
import type { ClienteDetalleCompleto } from "@/lib/data/cliente-detalle";
import type { BitacoraEntrada } from "@/lib/data/bitacora";
import type { OnboardingResumen } from "@/lib/data/onboarding";
import type { Reunion } from "@/lib/data/meetings";
import type { UsuarioResumen } from "@/lib/data/users";

export function ClienteView({
  cliente,
  usuario,
  bitacora,
  onboarding,
  reuniones,
  responsables,
}: {
  cliente: ClienteDetalleCompleto;
  usuario: SidebarUsuario;
  bitacora: BitacoraEntrada[];
  onboarding: OnboardingResumen;
  reuniones: Reunion[];
  responsables: UsuarioResumen[];
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="clientes" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href="/clientes" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Clientes
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">{cliente.nombre}</span>
          <div className="flex-1" />
          <Link
            href={`/clientes/${cliente.id}/bitacora`}
            className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] text-[12.5px] font-semibold text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
              <path d="M6 3h9l3 3v15H6z" />
              <path d="M9 9h7M9 13h7M9 17h4" />
            </svg>
            Bitácora
          </Link>
          <Link
            href={`/clientes/${cliente.id}/informes`}
            className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] text-[12.5px] font-semibold text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
              <path d="M7 3h8l4 4v14H7z" />
              <path d="M11 12h6M11 16h6M11 8h3" />
            </svg>
            Informes
          </Link>
          <Link
            href={`/clientes/${cliente.id}/registro-seo`}
            className="btn-primary flex items-center gap-2 rounded-[9px] bg-accent px-[15px] py-2.5 text-[13px] font-semibold text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Registrar optimización
          </Link>
        </header>

        <div className="flex w-full max-w-[1360px] flex-col gap-5 px-[26px] pb-10 pt-[22px]">
          <ClienteHeader cliente={cliente} />

          <ServiciosPanel
            clientId={cliente.id}
            servicios={cliente.servicios}
            serviciosTiposExistentes={cliente.serviciosTiposExistentes}
            responsables={responsables}
          />

          <div className="col2 grid items-start gap-5" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
            <div className="flex flex-col gap-5">
              <TareasPanel
                clientId={cliente.id}
                tareas={cliente.tareas}
                proximaOptimizacion={cliente.proximaOptimizacion}
                responsables={responsables}
              />
              <BitacoraPanel entradas={bitacora} clienteId={cliente.id} />
            </div>
            <div className="flex flex-col gap-5">
              <DescuentosPanel clientId={cliente.id} descuentos={cliente.descuentos} />
              <ReunionesPanel clientId={cliente.id} reuniones={reuniones} />
              <OnboardingPanel clientId={cliente.id} resumen={onboarding} />
              <IntegracionesPanel clientId={cliente.id} configApis={cliente.configApis} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
