export function InsightCallout({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div className="rounded-[10px] bg-accent-soft px-4 py-3">
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-accent-soft-ink">✦ Insight</div>
      <p className="text-[13px] leading-snug text-ink">{texto}</p>
    </div>
  );
}
