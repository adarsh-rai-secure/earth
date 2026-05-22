export type PipelineStage = "uploaded" | "extracting" | "extracted" | "generating" | "complete" | "error";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "uploaded", label: "Upload" },
  { key: "extracted", label: "Extract" },
  { key: "complete", label: "Generate" },
];

export function ProcessingStatus({ stage, error }: { stage: PipelineStage; error?: string | null }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  const activeIdx =
    stage === "extracting" ? 1 : stage === "generating" ? 2 : idx === -1 ? 0 : idx;
  return (
    <div>
      <div className="flex items-center gap-2">
        {STAGES.map((s, i) => {
          const done = activeIdx > i || stage === "complete";
          const active = activeIdx === i && stage !== "complete" && stage !== "error";
          return (
            <div key={s.key} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  done
                    ? "border-brand bg-brand text-white"
                    : active
                    ? "border-accent bg-accent/15 text-accent animate-pulse"
                    : "border-border bg-card text-muted"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${done || active ? "text-foreground" : "text-muted"}`}>
                {s.label}
              </span>
              {i < STAGES.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${done ? "bg-brand" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </div>
  );
}
