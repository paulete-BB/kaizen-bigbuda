import Link from "next/link";
import { iniciarOptimizacion } from "@/lib/data/agente-actions";
import { SERVICIO_ADS_LABEL, type FilaAds, type MiDiaData, type Semaforo } from "@/lib/data/mi-dia";
import { fmtFecha } from "@/lib/dates";

export const SEMAFORO_COLOR: Record<Semaforo, { fg: string; bg: string; label: string }> = {
  rojo: { fg: "var(--color-danger)", bg: "var(--color-danger-bg)", label: "Revisar ya" },
  ambar: { fg: "var(--color-warning)", bg: "var(--color-warning-bg)", label: "Pendiente" },
  verde: { fg: "var(--color-success)", bg: "var(--color-success-bg)", label: "Al día" },
};

export const fmtMonto = (n: number) => `$${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })}`;

function Numero({ valor, etiqueta, color }: { valor: number; etiqueta: string; color?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] border border-border bg-surface px-5 py-4">
      <span className="text-[26px] font-bold leading-none [font-variant-numeric:tabular-nums]" style={{ color: valor > 0 && color ? color : "var(--color-ink)" }}>
        {valor}
      </span>
      <span className="text-[12px] font-semibold text-muted-2">{etiqueta}</span>
    </div>
  );
}

export function MetricasAyer({ fila }: { fila: FilaAds }) {
  if (!fila.ayer) return <span className="text-[12px] text-faint">Sin dato de ayer todavía</span>;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted [font-variant-numeric:tabular-nums]">
      <span className="text-[11px] font-semibold uppercase text-faint [letter-spacing:.03em]">Ayer</span>
      {fila.ayer.gasto !== null && <span>Gasto <b className="font-semibold text-ink">{fmtMonto(fila.ayer.gasto)}</b></span>}
      {fila.ayer.conversiones !== null && <span>Conv. <b className="font-semibold text-ink">{fila.ayer.conversiones.toLocaleString("es-CL")}</b></span>}
      {fila.ayer.cpa !== null && <span>Costo/conv. <b className="font-semibold text-ink">{fmtMonto(fila.ayer.cpa)}</b></span>}
    </div>
  );
}

export function Motivos({ fila }: { fila: FilaAds }) {
  if (fila.motivos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fila.motivos.map((m) => (
        <span
          key={m.texto}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: m.nivel === "rojo" ? "var(--color-danger)" : "var(--color-warning)", background: m.nivel === "rojo" ? "var(--color-danger-bg)" : "var(--color-warning-bg)" }}
        >
          {m.texto}
        </span>
      ))}
    </div>
  );
}

function FilaCola({ fila }: { fila: FilaAds }) {
  const sem = SEMAFORO_COLOR[fila.semaforo];
  const fechaTxt = fila.diasAtraso === 0 ? "Hoy" : `Desde el ${fmtFecha(fila.fechaProgramada!)}`;
  return (
    <div className="flex gap-4 rounded-[14px] border border-border bg-surface p-4" style={{ borderLeft: `4px solid ${sem.fg}` }}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/clientes/${fila.clienteId}`} className="text-[14.5px] font-bold text-ink">{fila.clienteNombre}</Link>
          <span className="text-[12.5px] font-semibold text-muted">{SERVICIO_ADS_LABEL[fila.servicioTipo]}</span>
          <span className="text-[11.5px] text-muted-2">· {fechaTxt}</span>
        </div>
        <Motivos fila={fila} />
        <MetricasAyer fila={fila} />
        {fila.pendientes && (
          <div className="rounded-[9px] bg-canvas px-3 py-2 text-[12px] text-muted">
            <span className="font-semibold text-ink">Quedó pendiente{fila.ultimaOptimizacion ? ` (${fmtFecha(fila.ultimaOptimizacion)})` : ""}: </span>
            <span className="whitespace-pre-line">{fila.pendientes.length > 280 ? `${fila.pendientes.slice(0, 280)}…` : fila.pendientes}</span>
          </div>
        )}
      </div>
      <div className="flex w-[190px] flex-none flex-col justify-center gap-2">
        {fila.optimizationId && fila.agenteEstado === "en_curso" ? (
          <Link href={`/optimizaciones/${fila.optimizationId}/agente`} className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-center font-sans text-[12.5px] font-semibold text-accent-soft-ink">
            Continuar optimización
          </Link>
        ) : fila.optimizationId ? (
          <form action={iniciarOptimizacion}>
            <input type="hidden" name="optimizationId" value={fila.optimizationId} />
            <button type="submit" className="w-full rounded-lg border-none bg-accent px-3 py-2 font-sans text-[12.5px] font-semibold text-white">Iniciar optimización</button>
          </form>
        ) : null}
        <Link href={`/clientes/${fila.clienteId}`} className="text-center text-[12px] font-semibold text-muted">Ver ficha</Link>
      </div>
    </div>
  );
}

export function MiDiaView({ data }: { data: MiDiaData }) {
  const { resumen, cola, semana } = data;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero valor={resumen.hoy} etiqueta="Cuentas para hoy" />
        <Numero valor={resumen.atrasadas} etiqueta="Atrasadas" color="var(--color-danger)" />
        <Numero valor={resumen.enRiesgo} etiqueta="En riesgo (sin conversiones, pacing)" color="var(--color-danger)" />
        <Numero valor={resumen.bloqueadas} etiqueta="Con aprobación pendiente" color="var(--color-warning)" />
      </div>

      {cola.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-surface px-6 py-10 text-center">
          <div className="text-[15px] font-bold">Estás al día</div>
          <p className="mt-1 text-[12.5px] text-muted-2">No tienes optimizaciones de hoy ni atrasadas. Lo que viene esta semana está abajo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] font-semibold text-muted-2">De la más atrasada a la de hoy</div>
          {cola.map((f) => (
            <FilaCola key={f.optimizationId ?? f.clienteId + f.servicioTipo} fila={f} />
          ))}
        </div>
      )}

      <details className="rounded-[14px] border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-3.5 text-[13px] font-bold">Esta semana · {semana.length}</summary>
        <div className="border-t border-border-soft px-5 py-2">
          {semana.length === 0 && <p className="py-4 text-center text-[12.5px] text-muted-2">No tienes nada más programado esta semana.</p>}
          {semana.map((s) => (
            <Link key={s.optimizationId} href={`/clientes/${s.clienteId}`} className="flex items-center justify-between border-b border-border-soft py-2.5 last:border-b-0">
              <span className="text-[13px] font-semibold text-ink">{s.clienteNombre} <span className="font-normal text-muted">· {SERVICIO_ADS_LABEL[s.servicioTipo] ?? s.servicioTipo}</span></span>
              <span className="text-[12px] text-muted-2">{fmtFecha(s.fecha)}</span>
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
