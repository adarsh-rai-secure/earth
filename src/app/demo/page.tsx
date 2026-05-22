"use client";

import { useState } from "react";
import { ProcessingStatus, type PipelineStage } from "@/app/components/ProcessingStatus";
import { ReportViewer, type Report } from "@/app/components/ReportViewer";

type Sample = { label: string; description: string; path: string; sizeKb: number };

const SAMPLES: Sample[] = [
  {
    label: "City Directory (small, ~1s)",
    description: "Historical occupancy excerpt — fastest end-to-end demonstration.",
    path: "/samples/city-directory-sample.pdf",
    sizeKb: 7,
  },
  {
    label: "Database Report (medium)",
    description: "Regulatory database export — radius hits, EDR-style entries.",
    path: "/samples/database-report-sample.pdf",
    sizeKb: 29,
  },
  {
    label: "Full Environmental Report (large)",
    description: "AMA Earth example output — produces the most complete draft.",
    path: "/samples/environmental-report-sample.pdf",
    sizeKb: 1090,
  },
];

type RunEntry = { t: number; label: string };

export default function DemoPage() {
  const [stage, setStage] = useState<PipelineStage>("uploaded");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [log, setLog] = useState<RunEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  function append(label: string) {
    setLog((l) => [...l, { t: Date.now(), label }]);
  }

  async function run(sample: Sample) {
    if (busy) return;
    setBusy(true);
    setRunning(sample.path);
    setErr(null);
    setReport(null);
    setDocId(null);
    setLog([]);
    const t0 = Date.now();

    try {
      append(`Fetching sample (${sample.sizeKb} KB)…`);
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`Could not fetch sample: ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], sample.path.split("/").pop() ?? "sample.pdf", {
        type: "application/pdf",
      });

      setStage("uploaded");
      append("Uploading to Supabase storage…");
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: form });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData?.error ?? `Upload HTTP ${upRes.status}`);
      setDocId(upData.documentId);
      append(`Uploaded — doc id ${upData.documentId.slice(0, 8)}…`);

      setStage("extracting");
      append("Extracting text (pdf-parse)…");
      const exRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: upData.documentId }),
      });
      const exData = await exRes.json();
      if (!exRes.ok) throw new Error(exData?.error ?? `Extract HTTP ${exRes.status}`);
      append(`Extracted ${exData.textLength} chars`);
      setStage("extracted");

      setStage("generating");
      append("Generating ESA draft (Claude Sonnet 4.5 via OpenRouter)…");
      const gnRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: upData.documentId }),
      });
      const gnData = await gnRes.json();
      if (!gnRes.ok) throw new Error(gnData?.error ?? `Generate HTTP ${gnRes.status}`);
      setReport(gnData.report as Report);
      setStage("complete");
      append(`Complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      setStage("error");
      setErr(e instanceof Error ? e.message : String(e));
      append(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setRunning(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-accent">Live demo</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Watch the full pipeline run in under a minute.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Click a sample. It fetches the PDF, uploads to Supabase storage, extracts text with
          pdf-parse, and asks Claude Sonnet 4.5 (via OpenRouter) for a structured Phase I ESA draft.
          No setup, no uploads — everything below is real.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {SAMPLES.map((s) => (
          <button
            key={s.path}
            onClick={() => run(s)}
            disabled={busy}
            className={`rounded-2xl border bg-card p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              running === s.path ? "border-brand bg-brand/5" : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="text-sm font-semibold">{s.label}</div>
            <p className="mt-1 text-xs text-muted">{s.description}</p>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
              {running === s.path ? "running…" : "click to run"}
            </p>
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <ProcessingStatus stage={stage} error={err} />
      </div>

      {log.length > 0 && (
        <details open className="mb-6 rounded-2xl border border-border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Run log</summary>
          <ul className="mt-3 space-y-1 font-mono text-xs text-muted">
            {log.map((l, i) => (
              <li key={i}>
                <span className="text-foreground/50">[{new Date(l.t).toLocaleTimeString()}]</span>{" "}
                {l.label}
              </li>
            ))}
          </ul>
        </details>
      )}

      {docId && (
        <p className="mb-4 text-xs text-muted">
          Tracking document id: <code className="rounded bg-card px-1 py-0.5">{docId}</code>
        </p>
      )}

      {report && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Draft Report</h2>
          <ReportViewer report={report} />
        </div>
      )}
    </div>
  );
}
