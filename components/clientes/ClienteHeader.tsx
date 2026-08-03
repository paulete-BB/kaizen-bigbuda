import Link from "next/link";
import type { ClienteDetalle } from "@/lib/clientes/types";

const ESTADO_LABEL: Record<ClienteDetalle["estado"], string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
};

export function ClienteHeader({ cliente }: { cliente: ClienteDetalle }) {
  return (
    <section className="flex items-start gap-5 rounded-[14px] border border-border bg-surface p-[22px_24px]">
      <div
        className="flex h-16 w-16 flex-none items-center justify-center rounded-[14px] text-[28px] font-bold text-white"
        style={{ background: "linear-gradient(135deg,#a86f1c,#c8952f)" }}
      >
        {cliente.logoIniciales}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[23px] font-bold [letter-spacing:-0.5px]">{cliente.nombre}</h1>
          {cliente.estado === "activo" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-[3px] text-[11.5px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {ESTADO_LABEL[cliente.estado]}
            </span>
          )}
        </div>
        <div className="mt-1 text-[13px] text-muted-2">
          {cliente.empresa} · {cliente.industria} · <a href={`https://${cliente.sitioWeb}`}>{cliente.sitioWeb}</a>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-[22px] text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted-2)" strokeWidth="1.7">
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
            </svg>
            <b className="font-semibold text-ink">{cliente.contactoNombre}</b> · Contacto
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted-2)" strokeWidth="1.7">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M4 7l8 6 8-6" />
            </svg>
            {cliente.contactoEmail}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted-2)" strokeWidth="1.7">
              <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
            {cliente.contactoTelefono}
          </span>
        </div>
      </div>
      <div className="flex flex-none flex-col gap-2">
        <button className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] font-sans text-[12.5px] font-semibold text-ink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M13 3v5h5" />
          </svg>
          Ver informes
        </button>
        <Link
          href={`/clientes/${cliente.id}/bitacora`}
          className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] font-sans text-[12.5px] font-semibold text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
            <path d="M8 4h8v16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
            <path d="M10 8h4M10 12h4M10 16h3" />
          </svg>
          Ver bitácora en ClickUp
        </Link>
      </div>
    </section>
  );
}
