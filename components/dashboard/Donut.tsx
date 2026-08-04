interface DonutSegment {
  pct: number;
  color: string;
}

export function Donut({
  segments,
  size = 72,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  centerLabel: string;
}) {
  const offsets = segments.reduce<number[]>((acc, s, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + segments[i - 1].pct);
    return acc;
  }, []);

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border-soft)" strokeWidth="5" />
        <g transform="rotate(-90 21 21)">
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={s.color}
              strokeWidth="5"
              strokeDasharray={`${s.pct} ${100 - s.pct}`}
              strokeDashoffset={-offsets[i]}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold">{centerLabel}</div>
    </div>
  );
}
