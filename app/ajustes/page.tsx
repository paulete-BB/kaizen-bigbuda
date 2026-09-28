import { AjustesView } from "@/components/ajustes/AjustesView";
import { getSettings } from "@/lib/data/settings";
import { listAusencias } from "@/lib/data/ausencias";
import { listFeriados } from "@/lib/data/holidays";
import { listResponsables } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/server";
import { obtenerEstadoConexionGoogle } from "@/lib/google/oauth";

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ google?: string; google_error?: string }> }) {
  const session = await requireUser();
  const [settings, googleEstado, params, ausencias, feriados, responsables] = await Promise.all([
    getSettings(),
    obtenerEstadoConexionGoogle(),
    searchParams,
    listAusencias(),
    listFeriados(),
    listResponsables(),
  ]);

  return (
    <AjustesView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      esAdmin={session.rol === "admin"}
      usuarioActualId={session.userId}
      settings={settings}
      googleEstado={googleEstado}
      googleResultado={params.google}
      googleError={params.google_error}
      ausencias={ausencias}
      feriados={feriados}
      responsables={responsables}
    />
  );
}
