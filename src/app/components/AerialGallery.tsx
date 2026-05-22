"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToDataUrl, composeMarkedDataUrl, downsampleDataUrl } from "@/lib/canvas-mark";
import { getPageCount, renderPdfToCanvases } from "@/lib/pdf-render";
import type { ParcelLookupResult } from "@/app/components/AddressInput";

type Tile = {
  pageIndex: number;
  rawDataUrl: string | null;
  markedDataUrl: string | null;
  pageText: string;
  status: "pending" | "rendering" | "ready" | "marking" | "error";
  mark?: {
    visible: boolean;
    confidence: number;
    rationale: string;
  };
  error?: string;
};

const MARK_CONCURRENCY = 4;
const MARK_INPUT_MAX_SIDE = 1024;

export function AerialGallery({
  file,
  parcel,
  baseFilename,
}: {
  file: File | null;
  parcel: ParcelLookupResult | null;
  baseFilename?: string;
}) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [renderBusy, setRenderBusy] = useState(false);
  const [markBusy, setMarkBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setTiles([]);
    setErr(null);
    if (!file) return;
    setRenderBusy(true);

    (async () => {
      try {
        const count = await getPageCount(file);
        setTiles(
          Array.from({ length: count }, (_, i) => ({
            pageIndex: i,
            rawDataUrl: null,
            markedDataUrl: null,
            pageText: "",
            status: "pending" as const,
          }))
        );

        for await (const page of renderPdfToCanvases(file, { dpi: 100 })) {
          if (cancelRef.current) return;
          const rawDataUrl = canvasToDataUrl(page.canvas);
          setTiles((prev) => {
            const next = [...prev];
            next[page.pageIndex] = {
              pageIndex: page.pageIndex,
              rawDataUrl,
              markedDataUrl: null,
              pageText: page.pageText,
              status: "ready",
            };
            return next;
          });
        }
      } catch (e) {
        if (!cancelRef.current) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelRef.current) setRenderBusy(false);
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [file]);

  const markOne = useCallback(
    async (idx: number) => {
      if (!parcel) return;
      setTiles((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], status: "marking", error: undefined };
        return next;
      });
      try {
        // Read latest tile state from a fresh setTiles closure
        let raw: string | null = null;
        setTiles((prev) => {
          raw = prev[idx]?.rawDataUrl ?? null;
          return prev;
        });
        if (!raw) throw new Error("Tile has no rendered image yet");

        const downsampled = await downsampleDataUrl(raw, MARK_INPUT_MAX_SIDE, 0.85);

        const res = await fetch("/api/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: downsampled,
            parcel: parcel.parcel,
            address: parcel.addressNormalized,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

        const markedDataUrl =
          data.visible && Array.isArray(data.pixelPolygon) && data.pixelPolygon.length >= 3
            ? await composeMarkedDataUrl(raw, data.pixelPolygon)
            : null;

        setTiles((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = {
              ...next[idx],
              markedDataUrl,
              status: "ready",
              mark: {
                visible: Boolean(data.visible),
                confidence: Number(data.confidence ?? 0),
                rationale: String(data.rationale ?? ""),
              },
            };
          }
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setTiles((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], status: "error", error: msg };
          return next;
        });
      }
    },
    [parcel]
  );

  const markAll = useCallback(async () => {
    if (!parcel || markBusy) return;
    setMarkBusy(true);
    setErr(null);
    try {
      const indices: number[] = [];
      // pick fresh ready tiles
      setTiles((prev) => {
        prev.forEach((t, i) => {
          if (t.status === "ready") indices.push(i);
        });
        return prev;
      });

      const queue = [...indices];
      const workers = Array.from({ length: MARK_CONCURRENCY }, async () => {
        while (queue.length > 0) {
          const i = queue.shift();
          if (i === undefined) break;
          await markOne(i);
        }
      });
      await Promise.all(workers);
    } finally {
      setMarkBusy(false);
    }
  }, [parcel, markBusy, markOne]);

  const downloadTile = useCallback(
    (tile: Tile) => {
      const url = tile.markedDataUrl ?? tile.rawDataUrl;
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      const base = (baseFilename ?? file?.name ?? "aerial").replace(/\.[^.]+$/, "");
      const tag = tile.markedDataUrl ? "marked" : "raw";
      a.download = `${base}-page-${String(tile.pageIndex + 1).padStart(2, "0")}-${tag}.png`;
      a.click();
    },
    [baseFilename, file]
  );

  const downloadAll = useCallback(async () => {
    for (const tile of tiles) {
      if (tile.rawDataUrl || tile.markedDataUrl) {
        downloadTile(tile);
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }, [tiles, downloadTile]);

  if (!file) return null;

  const ready = tiles.filter((t) => t.status === "ready" || t.status === "marking").length;
  const markedCount = tiles.filter((t) => t.markedDataUrl).length;
  const total = tiles.length;
  const canMark = !!parcel && ready > 0 && !markBusy && !renderBusy;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Aerial timeline
          </div>
          <div className="mt-1 text-sm">
            {renderBusy ? (
              <span className="text-muted">
                Rendering pages in browser… {ready}/{total || "?"}
              </span>
            ) : err ? (
              <span className="text-error">Error: {err}</span>
            ) : total > 0 ? (
              <span>
                {total} page{total === 1 ? "" : "s"} rendered
                {markedCount > 0 && (
                  <span className="ml-2 text-muted">· {markedCount} marked</span>
                )}
              </span>
            ) : (
              <span className="text-muted">Waiting for PDF…</span>
            )}
          </div>
          {!parcel && tiles.length > 0 && (
            <p className="mt-1 text-[11px] text-warn">
              Look up a property in section 1 first — the marker needs the parcel polygon.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={markAll}
            disabled={!canMark}
            className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            title={!parcel ? "Select a property first" : "Sends each page to Claude Sonnet 4.5 (vision) to find the parcel"}
          >
            {markBusy ? `Marking… ${markedCount}/${total}` : `Mark all ${total} pages`}
          </button>
          <button
            onClick={downloadAll}
            disabled={renderBusy || total === 0}
            className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:border-foreground/30 disabled:opacity-60"
          >
            Download all PNGs
          </button>
        </div>
      </div>

      {tiles.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted">
          {renderBusy ? "Reading PDF…" : "—"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {tiles.map((tile, i) => (
            <TileView
              key={tile.pageIndex}
              tile={tile}
              onDownload={() => downloadTile(tile)}
              onMark={() => markOne(i)}
              canMark={!!parcel && tile.status !== "marking"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TileView({
  tile,
  onDownload,
  onMark,
  canMark,
}: {
  tile: Tile;
  onDownload: () => void;
  onMark: () => void;
  canMark: boolean;
}) {
  const displayUrl = tile.markedDataUrl ?? tile.rawDataUrl;
  const conf = tile.mark?.confidence ?? null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="relative aspect-[4/3] w-full bg-foreground/[0.04]">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={`Aerial page ${tile.pageIndex + 1}`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            {tile.status === "pending" ? "queued" : "rendering…"}
          </div>
        )}
        {tile.status === "marking" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-foreground">
            marking…
          </div>
        )}
        {tile.mark && (
          <div className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold shadow">
            {tile.mark.visible ? (
              <span className="text-brand">
                conf {(conf! * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-muted">not visible</span>
            )}
          </div>
        )}
      </div>
      <div className="px-3 pb-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Page {tile.pageIndex + 1}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onMark}
              disabled={!canMark}
              className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              {tile.markedDataUrl ? "Re-mark" : "Mark"}
            </button>
            <button
              onClick={onDownload}
              disabled={!displayUrl}
              className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
            >
              Download
            </button>
          </div>
        </div>
        {tile.pageText && (
          <div className="mt-1 line-clamp-1 text-[10px] text-muted" title={tile.pageText}>
            📄 {tile.pageText.slice(0, 120)}
          </div>
        )}
        {tile.mark?.rationale && (
          <div className="mt-1 line-clamp-2 text-[10px] text-muted" title={tile.mark.rationale}>
            {tile.mark.rationale}
          </div>
        )}
        {tile.error && (
          <div className="mt-1 text-[10px] text-error">{tile.error}</div>
        )}
      </div>
    </div>
  );
}
