import Link from "next/link";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-accent">
            Phase I ESA · ASTM E1527-21
          </p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Deliver environmental reports faster.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-7 text-muted">
            Turn messy records and PDFs into review-ready deliverables. Built for environmental
            consultants who refuse to choose between speed and accuracy.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
              Start Free Trial
            </button>
            <Link
              href="/assessments"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground/30"
            >
              Try the demo →
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="h-2.5 w-2.5 rounded-full bg-error/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-warn/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-xs text-muted">site-7-oliver-street.pdf</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <PipelineRow label="PDF Ingest" detail="5 documents · 247 pages" state="done" />
              <PipelineRow label="Raw Extraction" detail="city directory, radius map" state="done" />
              <PipelineRow label="Cross-Doc Correlation" detail="3 historical uses matched" state="done" />
              <PipelineRow label="Draft Report" detail="REC, HREC, AOC table generated" state="active" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PipelineRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "done" | "active" | "pending";
}) {
  const dotClass =
    state === "done"
      ? "bg-success"
      : state === "active"
      ? "bg-accent animate-pulse"
      : "bg-border";
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-xs text-muted">{detail}</span>
    </div>
  );
}
