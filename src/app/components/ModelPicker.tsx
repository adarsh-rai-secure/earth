"use client";

import { MODELS, type ModelChoice } from "@/lib/models";

export function ModelPicker({
  value,
  onChange,
  disabled,
  label = "Generation model",
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const current: ModelChoice | undefined = MODELS.find((m) => m.id === value);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>
        {current && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted">
            {current.provider} · {current.tier}
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:opacity-60"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.provider}
          </option>
        ))}
      </select>
      {current && <p className="mt-2 text-xs text-muted leading-5">{current.blurb}</p>}
    </div>
  );
}
