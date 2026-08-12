import { AjustesView } from "@/components/ajustes/AjustesView";
import { getSettings } from "@/lib/data/settings";
import { requireUser } from "@/lib/auth/server";
import { obtenerEstadoConexionGoogle } from "@/lib/google/oauth";

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ google?: string; google_error?: string }> }) {
  const session = await requireUser();
  const [settings, googleEstado, params] = await Promise.all([getSettings(), obtenerEstadoConexionGoogle(), searchParams]);

  return (
    <AjustesView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      esAdmin={session.rol === "admin"}
      settings={settings}
      googleEstado={googleEstado}
      googleResultado={params.google}
      googleError={params.google_error}
    />
  );
}
