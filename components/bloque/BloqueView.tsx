import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { BloqueCard } from "./BloqueCard";
import type { ItemBloque } from "@/lib/data/bloque";
import { fmtFecha, parseIso } from "@/lib/dates";

export function BloqueView({
  usuario,
  fecha,
  items,
}: {
  usuario: SidebarUsuario;
  fecha: string;
  items: ItemBloque[];
}) {
  const d = parseIso(fecha);
  const mes = d.getMonth() + 1;
  const anio = d.getFullYear();
  const done = items.filter((i) => i.estado === "realizada").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const porCanal = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.tipo] = (acc[i.tipo] ?? 0) + 1;
    return acc;
  }, {});
  const fueraDeRango = items.filter((i) => i.alertaDisparada && i.estado !== "realizada").length;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="calendario" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href="/calendario" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Calendario
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">Bloque Ads · Miércoles 16:00</span>
          <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent-soft-ink">
            {fmtFecha(fecha)}
          </span>
        </header>

        <div className="flex w-full max-w-[900px] flex-col gap-4 px-[26px] pb-10 pt-[22px]">
          <div className="rounded-[14px] border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">Optimización de ads</span>
              <span className="text-[13px] font-semibold text-muted">
                {done} de {items.length} servicios completados · {pct}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-md bg-border-soft">
              <div className="h-full rounded-md bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
              <span>Meta Ads · {porCanal.meta_ads ?? 0}</span>
              <span>Google Ads · {porCanal.google_ads ?? 0}</span>
              {fueraDeRango > 0 && <span className="font-semibold text-danger">{fueraDeRango} servicio con ritmo de gasto fuera de rango</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {items.length === 0 && (
              <p className="py-10 text-center text-[12.5px] text-muted-2">No hay servicios de Ads programados este miércoles.</p>
            )}
            {items.map((item, i) => (
              <BloqueCard key={item.optimizationId} item={item} fecha={fecha} mes={mes} anio={anio} defaultOpen={i === 0 && item.alertaDisparada} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
