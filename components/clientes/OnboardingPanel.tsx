const ITEMS: { label: string; estado: "recibido" | "solicitado" | "pendiente" }[] = [
  { label: "Acceso a GA4", estado: "recibido" },
  { label: "Acceso a Search Console", estado: "recibido" },
  { label: "Verificación de píxel Meta", estado: "solicitado" },
  { label: "Vinculación GA4 ↔ Google Ads", estado: "pendiente" },
];

const ESTADO_LABEL: Record<(typeof ITEMS)[number]["estado"], { label: string; color: string }> = {
  recibido: { label: "Recibido", color: "var(--color-success)" },
  solicitado: { label: "Solicitado", color: "var(--color-warning)" },
  pendiente: { label: "Pendiente", color: "var(--color-faint)" },
};

export function OnboardingPanel({
  porcentaje = 85,
  totalItems = 13,
  completados = 11,
}: {
  porcentaje?: number;
  totalItems?: number;
  completados?: number;
}) {
  const dash = `${porcentaje} ${100 - porcentaje}`;
  const faltan = totalItems - completados;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <span className="text-[14px] font-bold">Onboarding</span>
        <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success">
          {porcentaje}% completado
        </span>
      </div>
      <div className="px-[18px] py-4">
        <div className="mb-3.5 flex items-center gap-3.5">
          <div className="relative h-[58px] w-[58px] flex-none">
            <svg width="58" height="58" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border-soft)" strokeWidth="5" />
              <g transform="rotate(-90 21 21)">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke="var(--color-success)"
                  strokeWidth="5"
                  strokeDasharray={dash}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold">
              {porcentaje}%
            </div>
          </div>
          <div className="text-[12px] leading-[1.45] text-muted">
            {completados} de {totalItems} ítems completados. Faltan {faltan} accesos por confirmar antes de la
            1.ª optimización.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {ITEMS.map((item) => {
            const estado = ESTADO_LABEL[item.estado];
            return (
              <div key={item.label} className="flex items-center gap-2 text-[12.5px]">
                {item.estado === "recibido" ? (
                  <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-success">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 12l4 4 10-11" />
                    </svg>
                  </span>
                ) : (
                  <span
                    className="h-[18px] w-[18px] flex-none rounded-[5px] border-[1.8px]"
                    style={{
                      borderColor: item.estado === "solicitado" ? "var(--color-warning-border)" : "var(--color-border)",
                      background: item.estado === "solicitado" ? "var(--color-warning-soft-bg)" : "transparent",
                    }}
                  />
                )}
                <span className="flex-1 text-muted">{item.label}</span>
                <span className="text-[10.5px] font-semibold" style={{ color: estado.color }}>
                  {estado.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
