import { CalendarioView } from "@/components/calendario/CalendarioView";
import { getMesCalendario } from "@/lib/data/calendario";
import { requireUser } from "@/lib/auth/server";
import { hoySantiago } from "@/lib/dates";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await requireUser();
  const params = await searchParams;
  const hoy = hoySantiago();
  const year = params.year ? Number(params.year) : hoy.getFullYear();
  const month = params.month ? Number(params.month) : hoy.getMonth() + 1;

  const { eventos, holidays } = await getMesCalendario(year, month);

  return (
    <CalendarioView
      usuario={{
        nombre: session.nombre,
        iniciales: session.nombre.slice(0, 2).toUpperCase(),
        rolLabel: session.rol === "admin" ? "Admin" : "Miembro del equipo",
      }}
      year={year}
      month={month}
      eventos={eventos}
      holidays={holidays}
    />
  );
}
