import Link from "next/link";
import type { AlertaItem, DashboardData } from "@/lib/data/dashboard";

function Categoria({ titulo, items }: { titulo: string; items: AlertaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-b border-border-soft-2 py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[12.5px] font-semibold">{titulo}</span>
        <span className="rounded-full bg-danger-bg px-2 py-px text-[10.5px] font-bold text-danger">{items.length}</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.slice(0, 3).map((item, i) => (
          <Link key={i} href={item.href} className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <b className="font-semibold text-ink">{item.clienteNombre}</b>
            <span className="text-muted-2">· {item.detalle}</span>
          </Link>
        ))}
        {items.length > 3 && <span className="text-[11px] text-muted-2">+{items.length - 3} más</span>}
      </div>
    </div>
  );
}

export function AlertasPanel({ data }: { data: DashboardData }) {
  const { alertas } = data;
  const total =
    alertas.atrasadas.length +
    alertas.pacing.length +
    alertas.aprobaciones.length +
    alertas.porVencer.length +
    alertas.informesPendientes.length +
    alertas.descuentosPorVencer.length +
    alertas.syncPendiente.length;

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-border bg-surface"
      style={{ borderTop: "3px solid var(--color-danger)" }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[14.5px] font-bold">Alertas</span>
        <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-bold text-danger">{total}</span>
      </div>
      <div className="px-5 pb-3">
        {total === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-muted-2">Sin alertas pendientes. Todo al día.</p>
        ) : (
          <>
            <Categoria titulo="Optimizaciones atrasadas" items={alertas.atrasadas} />
            <Categoria titulo="Desviaciones de ritmo de gasto" items={alertas.pacing} />
            <Categoria titulo="Aprobaciones sin respuesta" items={alertas.aprobaciones} />
            <Categoria titulo="Servicios por vencer" items={alertas.porVencer} />
            <Categoria titulo="Informes pendientes de envío" items={alertas.informesPendientes} />
            <Categoria titulo="Descuentos por vencer" items={alertas.descuentosPorVencer} />
            <Categoria titulo="Pendientes de sync a ClickUp" items={alertas.syncPendiente} />
          </>
        )}
      </div>
    </div>
  );
}
