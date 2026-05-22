export function BenefitsRow() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-accent">How It Works</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Minutes, not hours. Citations, not guesses.
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Benefit
          icon="⏱"
          title="Minutes not hours"
          body="A document set that used to take three days lands as a draft within an hour. Consultants focus on judgment, not transcription."
        />
        <Benefit
          icon="📍"
          title="Clear findings + evidence"
          body="Every REC, HREC, and CREC determination is tied back to the source line. AOC tables build themselves."
        />
        <Benefit
          icon="📝"
          title="Drafts + citations"
          body="Sections drafted in the ASTM E1527-21 order. Inline citations link directly to the source PDF and page."
        />
      </div>
    </section>
  );
}

function Benefit({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-lg text-brand">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
