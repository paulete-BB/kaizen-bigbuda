"use client";

export function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-muted-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
      />
    </label>
  );
}

export function CampoArea({
  label,
  value,
  onChange,
  placeholder,
  filas = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  filas?: number;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-muted-2">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={filas}
        className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
      />
    </label>
  );
}
