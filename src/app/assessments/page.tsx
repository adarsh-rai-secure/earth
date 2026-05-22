"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AddressInput, type ParcelLookupResult } from "@/app/components/AddressInput";
import { AerialGallery } from "@/app/components/AerialGallery";

const ParcelMap = dynamic(() => import("@/app/components/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted">
      Loading map…
    </div>
  ),
});

export default function AssessmentsPage() {
  const [address, setAddress] = useState("");
  const [parcel, setParcel] = useState<ParcelLookupResult | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [aerialFile, setAerialFile] = useState<File | null>(null);
  const [pdfCandidates, setPdfCandidates] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Programmatic lookup — used when user clicks a PDF candidate chip.
  const lookupAddress = useCallback(async (addr: string) => {
    setAddress(addr);
    setLookupBusy(true);
    try {
      const res = await fetch("/api/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      if (res.ok) setParcel(data as ParcelLookupResult);
    } finally {
      setLookupBusy(false);
    }
  }, []);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    setAerialFile(f);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-accent">Assessments</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Parcel boundary &amp; aerial timeline
        </h1>
        <p className="mt-2 text-sm text-muted">
          Type an address to pull the subject parcel boundary, then drop a multi-page aerial PDF to
          render each page as a PNG and have Claude Sonnet 4.5 draw the parcel boundary onto each
          aerial.
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
            <AddressInput
              address={address}
              setAddress={setAddress}
              onResult={setParcel}
              busy={lookupBusy}
              setBusy={setLookupBusy}
            />

            {pdfCandidates.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Addresses found in PDF
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pdfCandidates.map((c) => (
                    <button
                      key={c}
                      onClick={() => lookupAddress(c)}
                      disabled={lookupBusy}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11px] hover:border-brand hover:text-brand disabled:opacity-60"
                      title={`Use this address from the PDF: ${c}`}
                    >
                      <span className="truncate">{c}</span>
                      <span aria-hidden>→</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Click a chip to look up the parcel for that address.
                </p>
              </div>
            )}

            {parcel && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted">Found</div>
                <div className="mt-1 font-medium leading-snug">{parcel.addressNormalized}</div>
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
          <h2 className="text-lg font-semibold">2. Aerial photos</h2>
          {aerialFile && (
            <button
              onClick={() => {
                setAerialFile(null);
                setPdfCandidates([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear PDF
            </button>
          )}
        </div>

        {!aerialFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-colors ${
              dragging ? "border-brand bg-brand/5" : "border-border bg-card hover:border-foreground/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <p className="text-sm font-medium">Drop a multi-page aerial PDF here, or click to choose</p>
            <p className="mt-1 text-xs text-muted">
              Renders in your browser. After rendering, Claude Sonnet 4.5 draws the parcel boundary
              onto each aerial that contains a map.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted">Selected PDF</div>
              <div className="mt-1 font-medium">{aerialFile.name}</div>
              <div className="text-xs text-muted">{(aerialFile.size / 1_048_576).toFixed(2)} MB</div>
            </div>
            <AerialGallery
              file={aerialFile}
              parcel={parcel}
              baseFilename={aerialFile.name}
              onAddressCandidates={setPdfCandidates}
            />
          </div>
        )}
      </section>
    </div>
  );
}
