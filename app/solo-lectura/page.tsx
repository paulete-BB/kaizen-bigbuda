import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/auth/server";

export default async function SoloLecturaPage() {
  const session = await requireUser();
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        active="dashboard"
        usuario={{
          nombre: session.nombre,
          iniciales: session.nombre.slice(0, 2).toUpperCase(),
          rolLabel: session.rol === "admin" ? "Admin" : session.rol === "lector" ? "Solo lectura" : "Miembro del equipo",
        }}
      />
      <main className="flex min-w-0 flex-1 items-center justify-center px-6">
        <div className="max-w-md rounded-[14px] border border-border bg-surface px-8 py-10 text-center">
          <div className="text-[16px] font-bold">Tu usuario es de solo lectura</div>
          <p className="mt-2 text-[13px] text-muted-2">Puedes ver el dashboard, el calendario, los clientes y los resultados, pero no registrar ni cambiar nada. Si necesitas hacerlo, pídele a un administrador que te cambie el rol.</p>
          <Link href="/dashboard" className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[12.5px] font-semibold text-white">Volver al dashboard</Link>
        </div>
      </main>
    </div>
  );
}
