export function FooterBar() {
  return (
    <footer className="border-t border-border bg-card/60">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className="inline-block h-5 w-5 rounded-full bg-brand" />
              Ama Earth Group
            </div>
            <p className="mt-3 max-w-xs text-xs leading-5 text-muted">
              The operating system for environmental consultants. Built for the Phase I ESA workflow.
            </p>
          </div>
          <FooterCol title="Company" links={["About", "Blogs", "How It Works", "Team"]} />
          <FooterCol title="Legal" links={["Privacy Policy", "Terms of Service"]} />
          <FooterCol title="Newsletter" links={["Subscribe", "Schedule Demo"]} />
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted md:flex-row md:items-center">
          <span>© 2026 Ama Earth Group</span>
          <div className="flex flex-wrap items-center gap-4">
            <span>SOC 2 in progress</span>
            <span>ASTM E1527-21 Compliant</span>
            <span>LinkedIn · X · Instagram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="text-muted transition-colors hover:text-foreground">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
