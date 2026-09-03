import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { PromptEditor } from "./PromptEditor";
import { CopiarConVariables } from "./CopiarConVariables";
import { HistorialVersiones } from "./HistorialVersiones";
import type { ClienteParaVariables, PromptDetalle, PromptVersion } from "@/lib/data/prompts";

export function PromptDetalleView({
  usuario,
  prompt,
  versiones,
  clientes,
  esAdmin,
}: {
  usuario: SidebarUsuario;
  prompt: PromptDetalle;
  versiones: PromptVersion[];
  clientes: ClienteParaVariables[];
  esAdmin: boolean;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="prompts" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2.5 border-b border-border bg-surface px-[26px]">
          <Link href="/prompts" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Prompts
          </Link>
          <span className="text-faint">/</span>
          <span className="text-[13px] font-semibold">{prompt.titulo}</span>
        </header>

        <div className="grid w-full max-w-[1200px] gap-5 px-[26px] pb-10 pt-[22px]" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <PromptEditor prompt={prompt} esAdmin={esAdmin} />
          <div className="flex flex-col gap-5">
            <CopiarConVariables contenido={prompt.contenido} clientes={clientes} />
            <HistorialVersiones promptId={prompt.id} versionActual={prompt.version} versiones={versiones} />
          </div>
        </div>
      </main>
    </div>
  );
}
