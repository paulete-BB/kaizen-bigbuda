import { ResultadosView } from "@/components/resultados/ResultadosView";
import { listarClientesParaResultados, obtenerResultadosCliente, RANGOS_RESULTADOS, type RangoResultados } from "@/lib/data/resultados";
import { requireUser } from "@/lib/auth/server";

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; rango?: string }>;
}) {
  const session = await requireUser();
  const params = await searchParams;

  const clientes = await listarClientesParaResultados();
  if (clientes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-muted-2">No hay clientes activos para mostrar resultados.</p>
      </div>
    );
  }

  const clienteId = params.clienteId && clientes.some((c) => c.id === params.clienteId) ? params.clienteId : clientes[0].id;
  const rangoNum = Number(params.rango);
  const rango: RangoResultados = RANGOS_RESULTADOS.includes(rangoNum as RangoResultados) ? (rangoNum as RangoResultados) : 28;

  const data = await obtenerResultadosCliente(clienteId, rango);
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-muted-2">Cliente no encontrado.</p>
      </div>
    );
  }

  return (
    <ResultadosView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      clientes={clientes}
      data={data}
    />
  );
}
