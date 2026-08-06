import { AjustesView } from "@/components/ajustes/AjustesView";
import { getSettings } from "@/lib/data/settings";
import { requireUser } from "@/lib/auth/server";

export default async function AjustesPage() {
  const session = await requireUser();
  const settings = await getSettings();

  return (
    <AjustesView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      esAdmin={session.rol === "admin"}
      settings={settings}
    />
  );
}
