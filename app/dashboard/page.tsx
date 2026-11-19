import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/lib/data/dashboard";
import { getCarteraAds, getMiDia } from "@/lib/data/mi-dia";
import { requireUser } from "@/lib/auth/server";
import { asegurarOptimizacionesAds } from "@/lib/data/ads-calendario";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireUser();
  const { vista } = await searchParams;
  await asegurarOptimizacionesAds();
  const usuario = {
    nombre: session.nombre,
    iniciales: session.nombre.slice(0, 2).toUpperCase(),
    rolLabel: session.rol === "admin" ? "Admin" : session.rol === "lector" ? "Solo lectura" : "Miembro del equipo",
  };

  // "Mi día" es la pantalla de inicio: solo la cola de la persona logueada.
  // La cartera completa (y las alertas administrativas) vive en su pestaña.
  // El lector no tiene cola propia: su pantalla de inicio es la cartera.
  const esLector = session.rol === "lector";
  if (vista === "cartera" || esLector) {
    const cartera = await getCarteraAds();
    const data = await getDashboardData();
    return <DashboardView vista="cartera" cartera={cartera} data={data} usuario={usuario} soloCartera={esLector} />;
  }
  const miDia = await getMiDia(session.userId, session.nombre);
  return <DashboardView vista="mi-dia" miDia={miDia} usuario={usuario} />;
}
