"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [autoLookupTriedFor, setAutoLookupTriedFor] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset reference image whenever the parcel changes (or clears).
  useEffect(() => {
    setReferenceImage(null);
    setConfirmErr(null);
  }, [parcel?.parcel]);

  // Programmatic lookup — used by candidate chips AND by the PDF auto-lookup effect below.
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

  // PDF auto-lookup: when candidates first arrive and we have no parcel yet,
  // fire the lookup on the top candidate automatically. We track which list we've
  // tried so we don't loop or re-fire on re-renders.
  useEffect(() => {
    if (parcel) return;
    if (lookupBusy) return;
    if (pdfCandidates.length === 0) return;
    const top = pdfCandidates[0];
    const sig = pdfCandidates.join("|");
    if (autoLookupTriedFor === sig) return;
    setAutoLookupTriedFor(sig);
    void lookupAddress(top);
  }, [pdfCandidates, parcel, lookupBusy, autoLookupTriedFor, lookupAddress]);

  async function confirmParcel() {
    if (!parcel || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmErr(null);
    try {
      const res = await fetch("/api/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcel: parcel.parcel, size: 640 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setReferenceImage(data.dataUrl as string);
    } catch (e) {
      setConfirmErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmBusy(false);
    }
  }

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
          Type an address, or drop a multi-page aerial PDF and let us pull the address from it.
          Confirm the parcel, then have Claude Sonnet 4.5 draw the parcel boundary onto each aerial.
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
                  Top candidate auto-loaded when you dropped the PDF. Click another to switch.
                </p>
              </div>
            )}

            {parcel && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted">Found</div>
                    <div className="mt-1 font-medium leading-snug">{parcel.addressNormalized}</div>
                  </div>
                  {!referenceImage ? (
                    <button
                      onClick={confirmParcel}
                      disabled={confirmBusy}
                      className="inline-flex h-8 shrink-0 items-center rounded-full bg-brand px-3 text-[11px] font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                      title="Locks in this parcel and saves the Regrid view as a reference image for the vision model"
                    >
                      {confirmBusy ? "Confirming…" : "Confirm parcel"}
                    </button>
                  ) : (
                    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-success/15 px-3 text-[10px] font-semibold text-brand">
                      ✓ Confirmed
                    </span>
                  )}
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
                {confirmErr && <p className="mt-2 text-[11px] text-error">{confirmErr}</p>}
                {referenceImage && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted">
                      Reference image (sent to vision)
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referenceImage}
                      alt="Parcel reference image"
                      className="mt-1 w-full rounded-lg border border-border"
                    />
                  </div>
                )}
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
                setAutoLookupTriedFor(null);
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
              We extract the subject address from the PDF text and pre-load the parcel for you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted">Selected PDF</div>
                <div className="mt-1 font-medium">{aerialFile.name}</div>
                <div className="text-xs text-muted">{(aerialFile.size / 1_048_576).toFixed(2)} MB</div>
              </div>
              {parcel && !referenceImage && (
                <span className="rounded-full bg-warn/15 px-3 py-1 text-[11px] text-warn">
                  Confirm the parcel for higher-quality marking
                </span>
              )}
              {referenceImage && (
                <span className="rounded-full bg-success/15 px-3 py-1 text-[11px] text-brand">
                  Reference image active — vision will shape-match against it
                </span>
              )}
            </div>
            <AerialGallery
              file={aerialFile}
              parcel={parcel}
              referenceImageDataUrl={referenceImage}
              baseFilename={aerialFile.name}
              onAddressCandidates={setPdfCandidates}
            />
          </div>
        )}
      </section>
    </div>
  );
}
