"use client";

import Link from "next/link";
import { logout } from "@/lib/auth/actions";

type NavKey = "dashboard" | "calendario" | "clientes" | "ajustes";

export interface SidebarUsuario {
  nombre: string;
  iniciales: string;
  rolLabel: string;
}

const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "calendario", label: "Calendario", href: "/calendario" },
  { key: "clientes", label: "Clientes", href: "/clientes" },
  { key: "ajustes", label: "Ajustes", href: "/ajustes" },
];

function NavIcon({ item }: { item: NavKey }) {
  switch (item) {
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </>
      );
    case "calendario":
      return (
        <>
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </>
      );
    case "clientes":
      return (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 20c0-2.4-1-4.3-2.6-5.2" />
        </>
      );
    case "ajustes":
      return (
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
        </>
      );
  }
}

const PLACEHOLDER_ITEMS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Informes",
    icon: (
      <>
        <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21z" />
        <path d="M13.5 2.5V7h4.5M9 12.5h6M9 16h6" />
      </>
    ),
  },
  {
    label: "Prompts",
    icon: (
      <>
        <path d="M4 4.5h16v11H8l-4 3.5z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
  },
];

export function Sidebar({ active, usuario }: { active: NavKey | null; usuario: SidebarUsuario }) {
  return (
    <aside
      className="sb flex flex-none flex-col border-r border-border bg-surface"
      style={{ width: 236, position: "sticky", top: 0, height: "100vh" }}
    >
      <input type="checkbox" id="navchk" />
      <div className="brandrow flex items-center gap-2.5" style={{ padding: "22px 20px 16px" }}>
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-ink text-[17px] font-bold text-white [letter-spacing:-0.5px]">
          b
        </div>
        <div className="brandtext flex flex-col leading-[1.05]">
          <span className="text-[15px] font-bold [letter-spacing:-0.3px]">bigbuda</span>
          <span className="text-[10.5px] font-medium text-muted-2">Planificador</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" style={{ padding: "6px 12px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="navlink flex items-center gap-[11px] rounded-lg text-[13.5px] font-medium"
              style={{
                padding: "9px 11px",
                color: isActive ? "var(--color-accent-soft-ink)" : "var(--color-muted)",
                background: isActive ? "var(--color-accent-soft)" : "transparent",
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <NavIcon item={item.key} />
              </svg>
              {item.label}
            </Link>
          );
        })}
        {PLACEHOLDER_ITEMS.map((item) => (
          <a
            key={item.label}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="navlink flex items-center gap-[11px] rounded-lg text-[13.5px] font-medium text-muted"
            style={{ padding: "9px 11px" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {item.icon}
            </svg>
            {item.label}
          </a>
        ))}
      </nav>

      <div style={{ padding: "4px 12px 10px" }}>
        <label
          htmlFor="navchk"
          className="navlink navtoggle flex items-center gap-[11px] rounded-lg text-[13.5px] font-medium text-muted"
          style={{ padding: "9px 11px" }}
        >
          <svg
            className="tgl-ic flex-none"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            style={{ transition: "transform .18s" }}
          >
            <path d="M13 6l-6 6 6 6M18 6l-6 6 6 6" />
          </svg>
          Contraer
        </label>
      </div>

      <div className="border-t border-border-soft" style={{ padding: 12 }}>
        <div className="userrow flex items-center gap-2.5 rounded-[9px]" style={{ padding: "8px 10px" }}>
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-[12.5px] font-semibold text-white">
            {usuario.iniciales}
          </div>
          <div className="usertext min-w-0 flex-1 leading-[1.2]">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold">
              {usuario.nombre}
            </div>
            <div className="text-[11px] text-muted-2">{usuario.rolLabel}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-transparent"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted-2)" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
