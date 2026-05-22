"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileUpload, type UploadResult } from "@/app/components/FileUpload";
import { ProcessingStatus, type PipelineStage } from "@/app/components/ProcessingStatus";
import { ReportViewer, type Report } from "@/app/components/ReportViewer";
import { ModelPicker } from "@/app/components/ModelPicker";
import { AddressInput, type ParcelLookupResult } from "@/app/components/AddressInput";
import { DEFAULT_MODEL_ID } from "@/lib/models";

const ParcelMap = dynamic(() => import("@/app/components/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted">
      Loading map…
    </div>
  ),
});

export default function AssessmentsPage() {
  const [parcel, setParcel] = useState<ParcelLookupResult | null>(null);
  const [doc, setDoc] = useState<UploadResult | null>(null);
  const [stage, setStage] = useState<PipelineStage>("uploaded");
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);

  async function handleUploaded(r: UploadResult) {
    setDoc(r);
    setStage("extracting");
    setReport(null);
    setTextPreview(null);
    setErr(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: r.documentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setTextPreview(data.preview ?? null);
      setStage("extracted");
    } catch (e) {
      setStage("error");
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleGenerate() {
    if (!doc) return;
    setBusy(true);
    setStage("generating");
    setErr(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.documentId, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setReport(data.report as Report);
      setStage("complete");
    } catch (e) {
      setStage("error");
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetDoc() {
    setDoc(null);
    setStage("uploaded");
    setTextPreview(null);
    setReport(null);
    setErr(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-accent">Assessments</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">New Phase I ESA Draft</h1>
        <p className="mt-2 text-sm text-muted">
          Look up a subject property by address to pull its parcel boundary, then upload supporting
          documents to draft a Phase I ESA per ASTM E1527-21.
        </p>
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">1. Subject property</h2>
          {parcel && (
            <button
              onClick={() => setParcel(null)}
              className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear parcel
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_1fr]">
          <div className="space-y-4">
            <AddressInput onResult={setParcel} />
            {parcel && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted">Found</div>
                <div className="mt-1 font-medium leading-snug">
                  {parcel.addressNormalized}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
                  <dt className="text-muted">APN</dt>
                  <dd className="font-mono">{parcel.apn ?? "—"}</dd>
                  <dt className="text-muted">Acreage</dt>
                  <dd>{parcel.acreage != null ? `${Number(parcel.acreage).toFixed(2)} ac` : "—"}</dd>
                  <dt className="text-muted">Lat / Lng</dt>
                  <dd className="font-mono">
                    {parcel.centroid.lat.toFixed(5)}, {parcel.centroid.lng.toFixed(5)}
                  </dd>
                </dl>
              </div>
            )}
          </div>
          <ParcelMap parcel={parcel?.parcel ?? null} centroid={parcel?.centroid ?? null} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">2. Supporting documents</h2>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <ProcessingStatus stage={stage} error={err} />
          </div>
          <ModelPicker
            value={model}
            onChange={setModel}
            disabled={busy || stage === "generating"}
          />
        </div>

        {!doc ? (
          <FileUpload onUploaded={handleUploaded} />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <div className="text-sm font-medium">{doc.filename}</div>
                <div className="text-xs text-muted">doc id: {doc.documentId}</div>
              </div>
              <button
                onClick={resetDoc}
                className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Reset
              </button>
            </div>

            {textPreview && (
              <details className="rounded-2xl border border-border bg-card p-4 text-sm">
                <summary className="cursor-pointer font-medium">
                  Extracted text preview ({textPreview.length} chars)
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-xs text-muted">{textPreview}</pre>
              </details>
            )}

            {!report && stage !== "complete" && (
              <button
                onClick={handleGenerate}
                disabled={busy || stage === "extracting" || stage === "generating"}
                className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stage === "generating" ? "Drafting report…" : "Generate report →"}
              </button>
            )}

            {report && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Draft Report</h2>
                  <DownloadJsonButton report={report} filename={doc.filename} />
                </div>
                <ReportViewer report={report} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DownloadJsonButton({ report, filename }: { report: Report; filename: string }) {
  const onDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^.]+$/, "")}-draft.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={onDownload}
      className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30"
    >
      Download JSON
    </button>
  );
}
