"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClienteDetalleCompleto } from "@/lib/data/cliente-detalle";
import { editarCliente } from "@/lib/data/cliente-actions";

const ESTADO_LABEL: Record<ClienteDetalleCompleto["estado"], string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
};

export function ClienteHeader({ cliente }: { cliente: ClienteDetalleCompleto }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    nombre: cliente.nombre,
    empresa: cliente.empresa,
    contactoNombre: cliente.contactoNombre,
    contactoEmail: cliente.contactoEmail,
    contactoTelefono: cliente.contactoTelefono ?? "",
    sitioWeb: cliente.sitioWeb ?? "",
    industria: cliente.industria ?? "",
  });

  function abrirEdicion() {
    setDraft({
      nombre: cliente.nombre,
      empresa: cliente.empresa,
      contactoNombre: cliente.contactoNombre,
      contactoEmail: cliente.contactoEmail,
      contactoTelefono: cliente.contactoTelefono ?? "",
      sitioWeb: cliente.sitioWeb ?? "",
      industria: cliente.industria ?? "",
    });
    setError(null);
    setEditing(true);
  }

  async function guardar() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("clientId", cliente.id);
    fd.set("nombre", draft.nombre);
    fd.set("empresa", draft.empresa);
    fd.set("contactoNombre", draft.contactoNombre);
    fd.set("contactoEmail", draft.contactoEmail);
    fd.set("contactoTelefono", draft.contactoTelefono);
    fd.set("sitioWeb", draft.sitioWeb);
    fd.set("industria", draft.industria);
    try {
      const res = await editarCliente(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-[22px_24px]" style={{ borderTop: "3px solid var(--color-accent)" }}>
        <div className="text-[13px] font-bold uppercase text-faint [letter-spacing:.03em]">Editar cliente</div>
        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Nombre</span>
            <input value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Empresa</span>
            <input value={draft.empresa} onChange={(e) => setDraft((d) => ({ ...d, empresa: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Contacto</span>
            <input value={draft.contactoNombre} onChange={(e) => setDraft((d) => ({ ...d, contactoNombre: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Email del contacto</span>
            <input type="email" value={draft.contactoEmail} onChange={(e) => setDraft((d) => ({ ...d, contactoEmail: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Teléfono</span>
            <input value={draft.contactoTelefono} onChange={(e) => setDraft((d) => ({ ...d, contactoTelefono: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Sitio web</span>
            <input value={draft.sitioWeb} onChange={(e) => setDraft((d) => ({ ...d, sitioWeb: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-2">Industria</span>
            <input value={draft.industria} onChange={(e) => setDraft((d) => ({ ...d, industria: e.target.value }))} className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink" />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={guardar} disabled={pending} className="btn-primary rounded-lg border-none bg-accent px-4 py-2.5 font-sans text-[12.5px] font-semibold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={() => setEditing(false)} className="ghost rounded-lg border border-border bg-surface px-4 py-2.5 font-sans text-[12.5px] font-semibold text-muted">
            Cancelar
          </button>
        </div>
      </section>
    );
  }

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
          {cliente.empresa}
          {cliente.industria ? ` · ${cliente.industria}` : ""}
          {cliente.sitioWeb ? (
            <>
              {" · "}
              <a href={`https://${cliente.sitioWeb}`}>{cliente.sitioWeb}</a>
            </>
          ) : null}
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
        <button
          onClick={abrirEdicion}
          className="qa flex items-center gap-2 rounded-[9px] border border-border bg-surface px-[13px] py-[9px] font-sans text-[12.5px] font-semibold text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8">
            <path d="M4 20h4l10-10-4-4L4 16z" />
            <path d="M13.5 5.5l4 4" />
          </svg>
          Editar cliente
        </button>
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
