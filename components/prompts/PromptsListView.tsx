import Link from "next/link";
import { Sidebar, type SidebarUsuario } from "@/components/layout/Sidebar";
import { FiltrosPrompts } from "./FiltrosPrompts";
import { NuevoPromptDrawer } from "./NuevoPromptDrawer";
import type { PromptCategoria, PromptResumen } from "@/lib/data/prompts";
import { fmtFecha } from "@/lib/dates";

const CATEGORIA_COLOR: Record<PromptCategoria, { fg: string; bg: string }> = {
  SEO: { fg: "var(--color-svc-seo)", bg: "#efecfb" },
  AEO: { fg: "#eda100", bg: "#fdf3e0" },
  GEO: { fg: "#0d9488", bg: "#e3f4f2" },
  "Meta Ads": { fg: "#2563eb", bg: "#e8f0fe" },
  "Google Ads": { fg: "var(--color-svc-google)", bg: "#e3f4f2" },
  Informes: { fg: "var(--color-muted)", bg: "var(--color-border-soft)" },
  Otros: { fg: "var(--color-muted)", bg: "var(--color-border-soft)" },
};

export function PromptsListView({
  usuario,
  prompts,
  q,
  categoria,
}: {
  usuario: SidebarUsuario;
  prompts: PromptResumen[];
  q: string;
  categoria: PromptCategoria | "";
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="prompts" usuario={usuario} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-[26px]">
          <div>
            <div className="text-[14px] font-bold">Prompts</div>
            <div className="text-[11.5px] text-muted-2">{prompts.length} prompts</div>
          </div>
          <div className="flex-1" />
          <FiltrosPrompts q={q} categoria={categoria} />
          <NuevoPromptDrawer />
        </header>

        <div className="flex flex-col gap-3 px-[26px] pb-10 pt-[22px]">
          {prompts.length === 0 ? (
            <p className="text-[12.5px] text-muted-2">
              {q || categoria ? "Ningún prompt coincide con el filtro." : "Todavía no hay prompts. Crea el primero."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
              {prompts.map((p, i) => {
                const color = CATEGORIA_COLOR[p.categoria];
                return (
                  <Link
                    key={p.id}
                    href={`/prompts/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 text-[13px]"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--color-border-soft)" }}
                  >
                    <span
                      className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ color: color.fg, background: color.bg }}
                    >
                      {p.categoria}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.titulo}</span>
                    {p.tags.length > 0 && (
                      <span className="hidden flex-none truncate text-[11.5px] text-muted-2 sm:inline">{p.tags.join(" · ")}</span>
                    )}
                    {p.herramienta && <span className="flex-none text-[11px] text-faint">{p.herramienta}</span>}
                    <span className="flex-none text-[11px] text-muted-2">v{p.version} · {fmtFecha(p.actualizadoEn.slice(0, 10))}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
