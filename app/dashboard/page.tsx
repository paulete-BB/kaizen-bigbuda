import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/lib/data/dashboard";
import { requireUser } from "@/lib/auth/server";

export default async function DashboardPage() {
  const session = await requireUser();
  const data = await getDashboardData();

  return (
    <DashboardView
      data={data}
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
    />
  );
}
