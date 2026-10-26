import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/lib/data/dashboard";
import { requireUser } from "@/lib/auth/server";
import { asegurarOptimizacionesAds } from "@/lib/data/ads-calendario";

export default async function DashboardPage() {
  const session = await requireUser();
  await asegurarOptimizacionesAds();
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
