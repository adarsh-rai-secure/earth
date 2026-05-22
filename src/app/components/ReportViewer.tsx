export type Report = {
  property_summary?: string;
  historical_uses?: Array<{ period: string; use: string; source_excerpt?: string }>;
  environmental_concerns?: Array<{ title: string; description: string; evidence?: string }>;
  regulatory_findings?: Array<{ database: string; site_name: string; distance?: string; status?: string }>;
  classifications?: Array<{ type: "REC" | "HREC" | "CREC" | "de_minimis"; description: string; rationale?: string }>;
  executive_summary?: string;
};

export function ReportViewer({ report }: { report: Report }) {
  return (
    <div className="space-y-6">
      {report.executive_summary && (
        <Section title="Executive Summary">
          <p className="text-sm leading-7">{report.executive_summary}</p>
        </Section>
      )}

      {report.property_summary && (
        <Section title="Property Summary">
          <p className="text-sm leading-7">{report.property_summary}</p>
        </Section>
      )}

      {report.historical_uses && report.historical_uses.length > 0 && (
        <Section title="Historical Uses">
          <ul className="space-y-2 text-sm">
            {report.historical_uses.map((h, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="font-medium">
                  {h.period} — {h.use}
                </div>
                {h.source_excerpt && (
                  <div className="mt-1 text-xs italic text-muted">“{h.source_excerpt}”</div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.classifications && report.classifications.length > 0 && (
        <Section title="Classifications">
          <ul className="space-y-3 text-sm">
            {report.classifications.map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.type === "REC"
                        ? "bg-error/10 text-error"
                        : c.type === "HREC"
                        ? "bg-accent/15 text-accent"
                        : c.type === "CREC"
                        ? "bg-warn/15 text-warn"
                        : "bg-muted/15 text-muted"
                    }`}
                  >
                    {c.type.toUpperCase()}
                  </span>
                  <span className="font-medium">{c.description}</span>
                </div>
                {c.rationale && <p className="text-xs text-muted leading-5">{c.rationale}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.environmental_concerns && report.environmental_concerns.length > 0 && (
        <Section title="Environmental Concerns">
          <ul className="space-y-2 text-sm">
            {report.environmental_concerns.map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="font-medium">{c.title}</div>
                <p className="mt-1 text-xs leading-5 text-foreground/80">{c.description}</p>
                {c.evidence && <p className="mt-2 text-xs italic text-muted">“{c.evidence}”</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.regulatory_findings && report.regulatory_findings.length > 0 && (
        <Section title="Regulatory Findings">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-background text-left">
                <tr>
                  <Th>Database</Th>
                  <Th>Site</Th>
                  <Th>Distance</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {report.regulatory_findings.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{r.database}</Td>
                    <Td>{r.site_name}</Td>
                    <Td>{r.distance ?? "—"}</Td>
                    <Td>{r.status ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-muted">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
