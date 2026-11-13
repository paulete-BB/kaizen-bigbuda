import Link from "next/link";
import { SERVICIO_ADS_LABEL, type FilaAds } from "@/lib/data/mi-dia";
import { fmtFecha } from "@/lib/dates";
import { MetricasAyer, Motivos, SEMAFORO_COLOR } from "./MiDiaView";

/** Cartera: todos los servicios de Ads del equipo, de mayor a menor riesgo. Los sanos se ven apagados. */
export function CarteraTabla({ filas }: { filas: FilaAds[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-soft text-[11px] font-bold uppercase text-faint [letter-spacing:.03em]">
              <th className="px-4 py-3">Estado</th>
              <th className="px-3 py-3">Cliente · servicio</th>
              <th className="px-3 py-3">Responsable</th>
              <th className="px-3 py-3">Por qué</th>
              <th className="px-3 py-3">Resultados de ayer</th>
              <th className="px-3 py-3">Última optimización</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-muted-2">No hay servicios de Ads activos.</td></tr>
            )}
            {filas.map((f) => {
              const sem = SEMAFORO_COLOR[f.semaforo];
              return (
                <tr key={f.clienteId + f.servicioTipo} className="border-b border-border-soft last:border-b-0" style={{ opacity: f.semaforo === "verde" ? 0.6 : 1 }}>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: sem.fg, background: sem.bg }}>{sem.label}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/clientes/${f.clienteId}`} className="font-bold text-ink">{f.clienteNombre}</Link>
                    <div className="text-[11.5px] text-muted-2">{SERVICIO_ADS_LABEL[f.servicioTipo]}</div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-muted">{f.responsable ?? <span className="text-faint">—</span>}</td>
                  <td className="px-3 py-3">{f.motivos.length ? <Motivos fila={f} /> : <span className="text-[12px] text-faint">—</span>}</td>
                  <td className="px-3 py-3"><MetricasAyer fila={f} /></td>
                  <td className="px-3 py-3 text-[12px] text-muted">{f.ultimaOptimizacion ? fmtFecha(f.ultimaOptimizacion) : <span className="text-faint">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
