"use client";

import { VISION_MODELS, findVisionModel } from "@/lib/vision-models";

const TIER_LABEL: Record<string, string> = {
  best: "Best",
  "best-alt": "Best alt",
  "cheap-fast": "Cheap + fast",
  cheapest: "Cheapest",
};

const TIER_TONE: Record<string, string> = {
  best: "bg-brand/15 text-brand",
  "best-alt": "bg-accent/15 text-accent",
  "cheap-fast": "bg-success/15 text-brand",
  cheapest: "bg-muted/15 text-muted",
};

export function VisionModelPicker({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const current = findVisionModel(value);
  return (
    <div className={compact ? "flex items-center gap-2" : "rounded-2xl border border-border bg-card p-3"}>
      {!compact && (
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
          Vision model
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`rounded-lg border border-border bg-background text-sm focus:border-brand focus:outline-none disabled:opacity-60 ${
            compact ? "h-9 px-2 text-xs" : "px-3 py-2"
          }`}
        >
          {VISION_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.provider} · {TIER_LABEL[m.tier]} · {m.approxCostPerPage}/page
            </option>
          ))}
        </select>
        {current && !compact && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_TONE[current.tier]}`}
          >
            {TIER_LABEL[current.tier]}
          </span>
        )}
      </div>
      {current && !compact && (
        <p className="mt-2 text-[11px] leading-4 text-muted">
          {current.blurb} · approx {current.approxCostPerPage} per page.
        </p>
      )}
    </div>
  );
}
