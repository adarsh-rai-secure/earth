import Link from "next/link";
import { Hero } from "@/app/components/Hero";
import { FeatureTriad } from "@/app/components/FeatureTriad";
import { BenefitsRow } from "@/app/components/BenefitsRow";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustedStrip />
      <FeatureTriad />
      <BenefitsRow />
      <CtaBlock />
    </>
  );
}

function TrustedStrip() {
  const logos = ["ELC", "Oak", "Bravo Family Foundation", "BioLeap"];
  return (
    <section className="border-y border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Trusted & Backed By
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-80">
          {logos.map((l) => (
            <span key={l} className="text-sm font-medium tracking-tight text-foreground/70">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="rounded-2xl border border-border bg-card px-8 py-12 text-center">
        <h3 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Ready to reduce busywork?
        </h3>
        <p className="mt-3 text-sm text-muted">
          250 free credits. No commitment. Bring your hardest report set.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
            Start Free Trial
          </button>
          <Link
            href="/assessments"
            className="inline-flex h-11 items-center rounded-full border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground/30"
          >
            Open Assessments demo →
          </Link>
        </div>
      </div>
    </section>
  );
}
