export function FeatureTriad() {
  return (
    <section id="product" className="border-y border-border bg-card/50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-accent">Product</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Review faster. Analyze faster. Draft smarter.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card
            title="Review Faster"
            subtitle="City Directory Extractor"
            sample={
              <div className="font-mono text-xs leading-relaxed">
                <div className="text-muted">123 Main St, 1985</div>
                <div>Susino Garage</div>
                <div className="text-muted">125 Main St, 1985</div>
                <div>Liberty Cleaners</div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-brand">
                  247 records extracted
                </div>
              </div>
            }
          />
          <Card
            title="Analyze Faster"
            subtitle="Database Report Analyzer"
            sample={
              <div className="space-y-2 text-xs">
                <RowBadge label="Historical uses" count={5} />
                <RowBadge label="Regulatory hits" count={2} />
                <RowBadge label="Within 1/4 mile" count={8} />
              </div>
            }
          />
          <Card
            title="Draft Smarter"
            subtitle="Environmental Report Writer"
            sample={
              <div className="text-xs leading-relaxed text-foreground/80">
                <p>
                  The subject property at 179 Oliver Street was operated as Susino Garage from
                  1932-1962. Five underground storage tanks were installed between 1944-1977
                  (NJDEP UST Facility ID 008385)…
                </p>
                <div className="mt-2 text-[10px] text-muted">[cite: city_directory_1985.pdf · pg 14]</div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Card({
  title,
  subtitle,
  sample,
}: {
  title: string;
  subtitle: string;
  sample: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-5 rounded-xl border border-border bg-background p-4">{sample}</div>
    </div>
  );
}

function RowBadge({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-full bg-brand px-2 text-[10px] font-semibold text-white">
        {count} found
      </span>
    </div>
  );
}
